import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ComplaintStatus, ListingStatus, type Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { CreateComplaintDto } from "./dto/create-complaint.dto.js";
import type { ListAdminComplaintsQueryDto } from "./dto/list-admin-complaints-query.dto.js";
import type { ResolveComplaintDto } from "./dto/resolve-complaint.dto.js";

const complaintInclude = {
  reporter: { select: { id: true, fullName: true, email: true, role: true } },
  reportedUser: { select: { id: true, fullName: true, email: true, role: true } },
  assignedAdmin: { select: { id: true, fullName: true, email: true } },
  listing: {
    select: {
      id: true,
      title: true,
      status: true,
      room: {
        select: {
          title: true,
          property: { select: { id: true, name: true, address: true, district: true, city: true } },
        },
      },
    },
  },
};

const ACTIVE_STATUSES: ComplaintStatus[] = [ComplaintStatus.OPEN, ComplaintStatus.INVESTIGATING];

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createForListing(reporterId: string, listingId: string, dto: CreateComplaintDto) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, status: ListingStatus.APPROVED },
      select: {
        id: true,
        title: true,
        room: { select: { property: { select: { landlordId: true } } } },
      },
    });

    if (!listing) throw new NotFoundException("Không tìm thấy tin đăng public để báo cáo.");

    const reportedUserId = listing.room.property.landlordId;
    if (reportedUserId === reporterId) {
      throw new BadRequestException("Bạn không thể báo cáo chính tin đăng của mình.");
    }

    const duplicate = await this.prisma.complaint.findFirst({
      where: {
        reporterId,
        listingId,
        type: dto.type,
        status: { in: ACTIVE_STATUSES },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException("Bạn đã có một báo cáo cùng loại đang được xử lý cho tin này.");
    }

    const complaint = await this.prisma.complaint.create({
      data: {
        reporterId,
        reportedUserId,
        listingId,
        type: dto.type,
        description: dto.description.trim(),
        evidenceUrl: dto.evidenceUrl?.trim() || null,
        status: ComplaintStatus.OPEN,
      },
      include: complaintInclude,
    });

    await this.notifications.notify({
      userId: reporterId,
      type: "COMPLAINT_CREATED",
      title: "Đã tiếp nhận báo cáo",
      message: `Báo cáo của bạn về tin “${listing.title}” đã được ghi nhận.`,
      href: "/complaints",
    });

    return complaint;
  }

  async listMine(reporterId: string) {
    return this.prisma.complaint.findMany({
      where: { reporterId },
      include: complaintInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async adminStats() {
    const [open, investigating, resolved, rejected] = await this.prisma.$transaction([
      this.prisma.complaint.count({ where: { status: ComplaintStatus.OPEN } }),
      this.prisma.complaint.count({ where: { status: ComplaintStatus.INVESTIGATING } }),
      this.prisma.complaint.count({ where: { status: ComplaintStatus.RESOLVED } }),
      this.prisma.complaint.count({ where: { status: ComplaintStatus.REJECTED } }),
    ]);
    return { open, investigating, resolved, rejected };
  }

  async listAdmin(query: ListAdminComplaintsQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ComplaintWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { type: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { reporter: { fullName: { contains: search, mode: "insensitive" } } },
              { reporter: { email: { contains: search, mode: "insensitive" } } },
              { listing: { title: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const skip = (page - 1) * limit;

    const [complaints, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({
        where,
        include: complaintInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return {
      complaints,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  private async getAdminComplaintOrThrow(id: string) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id }, include: complaintInclude });
    if (!complaint) throw new NotFoundException("Không tìm thấy báo cáo.");
    return complaint;
  }

  private ensureCanProcess(status: ComplaintStatus) {
    if (!ACTIVE_STATUSES.includes(status)) {
      throw new BadRequestException("Báo cáo này đã được xử lý xong.");
    }
  }

  private ensureAdminOwnership(assignedAdminId: string | null, adminId: string) {
    if (assignedAdminId && assignedAdminId !== adminId) {
      throw new ConflictException("Báo cáo này đang được một Admin khác xử lý.");
    }
  }

  async investigate(id: string, adminId: string) {
    const complaint = await this.getAdminComplaintOrThrow(id);
    this.ensureCanProcess(complaint.status);
    this.ensureAdminOwnership(complaint.assignedAdminId, adminId);

    if (complaint.status === ComplaintStatus.INVESTIGATING && complaint.assignedAdminId === adminId) {
      return complaint;
    }

    const updated = await this.prisma.complaint.update({
      where: { id },
      data: { status: ComplaintStatus.INVESTIGATING, assignedAdminId: adminId },
      include: complaintInclude,
    });

    await this.notifications.notify({
      userId: updated.reporterId,
      type: "COMPLAINT_INVESTIGATING",
      title: "Báo cáo đang được xử lý",
      message: "Admin đã tiếp nhận và đang kiểm tra báo cáo của bạn.",
      href: "/complaints",
    });

    return updated;
  }

  async resolve(id: string, adminId: string, dto: ResolveComplaintDto) {
    const complaint = await this.getAdminComplaintOrThrow(id);
    this.ensureCanProcess(complaint.status);
    this.ensureAdminOwnership(complaint.assignedAdminId, adminId);

    const updated = await this.prisma.complaint.update({
      where: { id },
      data: {
        status: ComplaintStatus.RESOLVED,
        assignedAdminId: adminId,
        adminNote: dto.adminNote.trim(),
        resolvedAt: new Date(),
      },
      include: complaintInclude,
    });

    await this.notifications.notify({
      userId: updated.reporterId,
      type: "COMPLAINT_RESOLVED",
      title: "Báo cáo đã được giải quyết",
      message: dto.adminNote.trim(),
      href: "/complaints",
    });

    return updated;
  }

  async reject(id: string, adminId: string, dto: ResolveComplaintDto) {
    const complaint = await this.getAdminComplaintOrThrow(id);
    this.ensureCanProcess(complaint.status);
    this.ensureAdminOwnership(complaint.assignedAdminId, adminId);

    const updated = await this.prisma.complaint.update({
      where: { id },
      data: {
        status: ComplaintStatus.REJECTED,
        assignedAdminId: adminId,
        adminNote: dto.adminNote.trim(),
        resolvedAt: new Date(),
      },
      include: complaintInclude,
    });

    await this.notifications.notify({
      userId: updated.reporterId,
      type: "COMPLAINT_REJECTED",
      title: "Báo cáo không được chấp nhận",
      message: dto.adminNote.trim(),
      href: "/complaints",
    });

    return updated;
  }
}
