import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, PropertyStatus, ReviewStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import { CreateReviewDto } from "./dto/create-review.dto.js";

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, status: PropertyStatus.ACTIVE },
      select: { id: true, name: true },
    });

    if (!property) throw new NotFoundException("Nhà trọ không tồn tại hoặc đang tạm ẩn.");

    const [reviews, aggregate, count] = await Promise.all([
      this.prisma.review.findMany({
        where: { propertyId, status: ReviewStatus.VISIBLE },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          tenant: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
      }),
      this.prisma.review.aggregate({
        where: { propertyId, status: ReviewStatus.VISIBLE },
        _avg: {
          overallRating: true,
          landlordRating: true,
          securityRating: true,
          noiseRating: true,
          costRating: true,
        },
      }),
      this.prisma.review.count({ where: { propertyId, status: ReviewStatus.VISIBLE } }),
    ]);

    return {
      property,
      reviews,
      summary: {
        count,
        overall: aggregate._avg.overallRating,
        landlord: aggregate._avg.landlordRating,
        security: aggregate._avg.securityRating,
        noise: aggregate._avg.noiseRating,
        cost: aggregate._avg.costRating,
      },
    };
  }

  async eligibility(tenantId: string, propertyId: string) {
    const [completedAppointment, existingReview] = await Promise.all([
      this.prisma.appointment.findFirst({
        where: {
          tenantId,
          status: AppointmentStatus.COMPLETED,
          room: { propertyId },
        },
        select: { id: true },
      }),
      this.prisma.review.findUnique({
        where: { tenantId_propertyId: { tenantId, propertyId } },
        select: { id: true, status: true },
      }),
    ]);

    return {
      eligible: Boolean(completedAppointment) && !existingReview,
      hasCompletedAppointment: Boolean(completedAppointment),
      hasReview: Boolean(existingReview),
      reviewStatus: existingReview?.status ?? null,
    };
  }

  async create(tenantId: string, propertyId: string, dto: CreateReviewDto) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, status: PropertyStatus.ACTIVE },
      select: { id: true },
    });
    if (!property) throw new NotFoundException("Không tìm thấy nhà trọ để đánh giá.");

    const existing = await this.prisma.review.findUnique({
      where: { tenantId_propertyId: { tenantId, propertyId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException("Bạn đã đánh giá nhà trọ này rồi.");

    const completedAppointment = await this.prisma.appointment.findFirst({
      where: {
        tenantId,
        status: AppointmentStatus.COMPLETED,
        room: { propertyId },
      },
      select: { id: true },
    });

    if (!completedAppointment) {
      throw new ForbiddenException("Bạn chỉ có thể đánh giá sau khi đã hoàn tất ít nhất một lịch xem tại nhà trọ này.");
    }

    return this.prisma.review.create({
      data: {
        tenantId,
        propertyId,
        overallRating: dto.overallRating,
        landlordRating: dto.landlordRating,
        securityRating: dto.securityRating,
        noiseRating: dto.noiseRating,
        costRating: dto.costRating,
        comment: dto.comment?.trim() || null,
        status: ReviewStatus.VISIBLE,
      },
      include: {
        tenant: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });
  }
}
