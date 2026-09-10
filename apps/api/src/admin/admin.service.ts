import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ListingStatus, UserRole, UserStatus, type Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import type { ListAdminListingsQueryDto } from "./dto/list-admin-listings-query.dto.js";
import type { ListUsersQueryDto } from "./dto/list-users-query.dto.js";
import type { RejectListingDto } from "./dto/reject-listing.dto.js";
import type { UpdateUserStatusDto } from "./dto/update-user-status.dto.js";

const listingInclude = {
  images: { orderBy: { sortOrder: "asc" as const } },
  reviewedByAdmin: {
    select: { id: true, fullName: true, email: true },
  },
  room: {
    include: {
      amenities: { include: { amenity: true } },
      property: {
        include: {
          landlord: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              status: true,
            },
          },
        },
      },
    },
  },
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const [pendingListings, approvedListings, rejectedListings, activeUsers, suspendedUsers, bannedUsers, landlords, tenants] =
      await this.prisma.$transaction([
        this.prisma.listing.count({ where: { status: ListingStatus.PENDING } }),
        this.prisma.listing.count({ where: { status: ListingStatus.APPROVED } }),
        this.prisma.listing.count({ where: { status: ListingStatus.REJECTED } }),
        this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
        this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
        this.prisma.user.count({ where: { status: UserStatus.BANNED } }),
        this.prisma.user.count({ where: { role: UserRole.LANDLORD } }),
        this.prisma.user.count({ where: { role: UserRole.TENANT } }),
      ]);

    return {
      listings: {
        pending: pendingListings,
        approved: approvedListings,
        rejected: rejectedListings,
      },
      users: {
        active: activeUsers,
        suspended: suspendedUsers,
        banned: bannedUsers,
        landlords,
        tenants,
      },
    };
  }

  async listListings(query: ListAdminListingsQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ListingWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { room: { title: { contains: search, mode: "insensitive" } } },
              { room: { property: { name: { contains: search, mode: "insensitive" } } } },
              { room: { property: { landlord: { fullName: { contains: search, mode: "insensitive" } } } } },
              { room: { property: { landlord: { email: { contains: search, mode: "insensitive" } } } } },
            ],
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [listings, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        include: listingInclude,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      listings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async listingDetail(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: listingInclude,
    });

    if (!listing) throw new NotFoundException("Không tìm thấy tin đăng.");
    return listing;
  }

  async approveListing(id: string, adminId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!listing) throw new NotFoundException("Không tìm thấy tin đăng.");
    if (listing.status !== ListingStatus.PENDING) {
      throw new BadRequestException("Chỉ có thể duyệt tin đang ở trạng thái PENDING.");
    }

    const now = new Date();
    return this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.APPROVED,
        publishedAt: now,
        reviewedAt: now,
        reviewedByAdminId: adminId,
        rejectionReason: null,
      },
      include: listingInclude,
    });
  }

  async rejectListing(id: string, adminId: string, dto: RejectListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!listing) throw new NotFoundException("Không tìm thấy tin đăng.");
    if (listing.status !== ListingStatus.PENDING) {
      throw new BadRequestException("Chỉ có thể từ chối tin đang ở trạng thái PENDING.");
    }

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.REJECTED,
        publishedAt: null,
        reviewedAt: new Date(),
        reviewedByAdminId: adminId,
        rejectionReason: dto.reason.trim(),
      },
      include: listingInclude,
    });
  }

  async listUsers(query: ListUsersQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const skip = (page - 1) * limit;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          firebaseUid: true,
          email: true,
          phone: true,
          fullName: true,
          avatarUrl: true,
          role: true,
          status: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              ownedProperties: true,
              reviews: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async updateUserStatus(targetUserId: string, adminId: string, dto: UpdateUserStatusDto) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, status: true },
    });

    if (!target) throw new NotFoundException("Không tìm thấy người dùng.");

    if (target.id === adminId && dto.status !== UserStatus.ACTIVE) {
      throw new BadRequestException("Admin không thể tự khóa tài khoản đang sử dụng.");
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { status: dto.status },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        updatedAt: true,
      },
    });
  }
}
