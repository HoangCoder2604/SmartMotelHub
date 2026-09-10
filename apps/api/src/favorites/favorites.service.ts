import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ListingStatus, PropertyStatus, RoomStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";

const favoriteListingInclude = {
  images: { orderBy: { sortOrder: "asc" as const } },
  room: {
    include: {
      property: true,
      amenities: { include: { amenity: true } },
    },
  },
};

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  private async publicListingOrThrow(listingId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: listingId,
        status: ListingStatus.APPROVED,
        room: {
          status: RoomStatus.AVAILABLE,
          property: { status: PropertyStatus.ACTIVE },
        },
      },
      select: { id: true },
    });

    if (!listing) {
      throw new NotFoundException("Tin đăng không tồn tại hoặc hiện không thể lưu.");
    }

    return listing;
  }

  async list(tenantId: string) {
    const favorites = await this.prisma.favorite.findMany({
      where: {
        tenantId,
        listing: {
          status: ListingStatus.APPROVED,
          room: {
            status: RoomStatus.AVAILABLE,
            property: { status: PropertyStatus.ACTIVE },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: { listing: { include: favoriteListingInclude } },
    });

    return favorites.map((favorite) => ({
      createdAt: favorite.createdAt,
      listing: favorite.listing,
    }));
  }

  async add(tenantId: string, listingId: string) {
    await this.publicListingOrThrow(listingId);

    const existing = await this.prisma.favorite.findUnique({
      where: { tenantId_listingId: { tenantId, listingId } },
      select: { tenantId: true },
    });

    if (existing) throw new ConflictException("Tin đăng này đã có trong danh sách yêu thích.");

    await this.prisma.favorite.create({ data: { tenantId, listingId } });
    return { listingId, favorited: true };
  }

  async remove(tenantId: string, listingId: string) {
    await this.prisma.favorite.deleteMany({ where: { tenantId, listingId } });
    return { listingId, favorited: false };
  }

  async status(tenantId: string, listingId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { tenantId_listingId: { tenantId, listingId } },
      select: { tenantId: true },
    });
    return { listingId, favorited: Boolean(favorite) };
  }
}
