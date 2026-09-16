import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { ListingStatus, PropertyStatus, RoomStatus, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import { CreateListingDto } from "./dto/create-listing.dto.js";
import { ListPublicListingsQueryDto, type PublicListingSort } from "./dto/list-public-listings-query.dto.js";
import { UpdateListingDto } from "./dto/update-listing.dto.js";

type UploadedImage = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type NearbyPropertyRow = {
  propertyId: string;
  distanceM: number;
};

const listingInclude = {
  images: { orderBy: { sortOrder: "asc" as const } },
  room: {
    include: {
      property: true,
      amenities: { include: { amenity: true } },
    },
  },
};

const EDITABLE_LISTING_STATUSES: ListingStatus[] = [ListingStatus.DRAFT, ListingStatus.REJECTED];

function detectImageExtension(buffer: Buffer): "jpg" | "png" | "webp" | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) return "png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

@Injectable()
export class ListingsService {
  private readonly uploadDir = join(process.cwd(), "uploads", "listings");
  private readonly storageBucket = process.env.SUPABASE_STORAGE_BUCKET ?? "listing-images";
  private readonly supabase: SupabaseClient | null;

  constructor(private readonly prisma: PrismaService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) : null;
  }

  private ensureEditableStatus(status: ListingStatus) {
    if (!EDITABLE_LISTING_STATUSES.includes(status)) {
      throw new BadRequestException("Chỉ có thể thao tác với tin ở trạng thái DRAFT hoặc REJECTED.");
    }
  }

  private async getOwnedListingOrThrow(id: string, landlordId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id, room: { property: { landlordId } } },
      include: listingInclude,
    });
    if (!listing) throw new NotFoundException("Không tìm thấy tin đăng hoặc bạn không phải chủ sở hữu.");
    return listing;
  }

  async listMine(landlordId: string) {
    return this.prisma.listing.findMany({
      where: { room: { property: { landlordId } } },
      orderBy: { createdAt: "desc" },
      include: listingInclude,
    });
  }

  async create(roomId: string, landlordId: string, dto: CreateListingDto) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, property: { landlordId } },
      include: { listings: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!room) throw new NotFoundException("Không tìm thấy phòng hoặc bạn không phải chủ sở hữu.");

    const current = room.listings[0];
    if (current) {
      throw new ConflictException("Phòng này đã có một tin đăng. Hãy chỉnh sửa hoặc gửi lại tin hiện tại.");
    }

    return this.prisma.listing.create({
      data: {
        roomId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        status: ListingStatus.DRAFT,
      },
      include: listingInclude,
    });
  }

  async update(id: string, landlordId: string, dto: UpdateListingDto) {
    const listing = await this.getOwnedListingOrThrow(id, landlordId);
    this.ensureEditableStatus(listing.status);

    return this.prisma.listing.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(listing.status === ListingStatus.REJECTED
          ? {
              status: ListingStatus.DRAFT,
              rejectionReason: null,
              reviewedAt: null,
              reviewedByAdminId: null,
            }
          : {}),
      },
      include: listingInclude,
    });
  }

  async submit(id: string, landlordId: string) {
    const listing = await this.getOwnedListingOrThrow(id, landlordId);
    this.ensureEditableStatus(listing.status);
    if (!listing.images.length) throw new BadRequestException("Hãy tải ít nhất 1 ảnh trước khi gửi duyệt.");

    return this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.PENDING,
        publishedAt: null,
        rejectionReason: null,
        reviewedAt: null,
        reviewedByAdminId: null,
      },
      include: listingInclude,
    });
  }

  async uploadImage(id: string, landlordId: string, file?: UploadedImage) {
    if (!file) throw new BadRequestException("Chưa chọn ảnh.");
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) throw new BadRequestException("Ảnh phải có dung lượng tối đa 5 MB.");

    const allowedMime = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedMime.has(file.mimetype)) throw new BadRequestException("MIME type ảnh không hợp lệ.");

    const extension = detectImageExtension(file.buffer);
    if (!extension) throw new BadRequestException("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP hợp lệ.");

    const expectedMime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
    if (file.mimetype !== expectedMime) throw new BadRequestException("Nội dung file không khớp với MIME type khai báo.");

    const listing = await this.getOwnedListingOrThrow(id, landlordId);
    this.ensureEditableStatus(listing.status);
    if (listing.images.length >= 8) throw new BadRequestException("Mỗi tin đăng được tối đa 8 ảnh.");

    const filename = `${randomUUID()}.${extension}`;

    if (this.supabase) {
      const objectPath = `listings/${id}/${filename}`;
      const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
      const { error: uploadError } = await this.supabase.storage.from(this.storageBucket).upload(objectPath, file.buffer, {
        contentType,
        upsert: false,
        cacheControl: "31536000",
      });
      if (uploadError) throw new BadRequestException(`Không thể tải ảnh lên storage: ${uploadError.message}`);

      const { data } = this.supabase.storage.from(this.storageBucket).getPublicUrl(objectPath);
      try {
        return await this.prisma.listingImage.create({
          data: {
            listingId: id,
            url: data.publicUrl,
            publicId: objectPath,
            sortOrder: listing.images.length,
          },
        });
      } catch (error) {
        await this.supabase.storage.from(this.storageBucket).remove([objectPath]).catch(() => undefined);
        throw error;
      }
    }

    // Local-development fallback when Supabase Storage is not configured.
    await mkdir(this.uploadDir, { recursive: true });
    const filePath = join(this.uploadDir, filename);
    await writeFile(filePath, file.buffer, { flag: "wx" });

    try {
      return await this.prisma.listingImage.create({
        data: {
          listingId: id,
          url: `/api/v1/listing-images/${filename}`,
          publicId: filename,
          sortOrder: listing.images.length,
        },
      });
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  async deleteImage(id: string, imageId: string, landlordId: string) {
    const listing = await this.getOwnedListingOrThrow(id, landlordId);
    this.ensureEditableStatus(listing.status);

    const image = listing.images.find((item) => item.id === imageId);
    if (!image) throw new NotFoundException("Không tìm thấy ảnh.");

    await this.prisma.listingImage.delete({ where: { id: imageId } });
    if (image.publicId) {
      if (this.supabase && image.publicId.includes("/")) {
        await this.supabase.storage.from(this.storageBucket).remove([image.publicId]).catch(() => undefined);
      } else {
        await unlink(join(this.uploadDir, image.publicId)).catch(() => undefined);
      }
    }
    return { id: imageId };
  }

  private buildPublicWhere(query: ListPublicListingsQueryDto, nearbyPropertyIds?: string[]): Prisma.ListingWhereInput {
    const amenityIds = [...new Set(query.amenityIds ?? [])];

    return {
      status: ListingStatus.APPROVED,
      room: {
        status: RoomStatus.AVAILABLE,
        price: {
          ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
          ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
        },
        areaM2: {
          ...(query.minArea !== undefined ? { gte: query.minArea } : {}),
          ...(query.maxArea !== undefined ? { lte: query.maxArea } : {}),
        },
        ...(query.minOccupants !== undefined ? { maxOccupants: { gte: query.minOccupants } } : {}),
        ...(query.hasMezzanine !== undefined ? { hasMezzanine: query.hasMezzanine } : {}),
        property: {
          status: PropertyStatus.ACTIVE,
          ...(nearbyPropertyIds ? { id: { in: nearbyPropertyIds } } : {}),
          ...(query.city ? { city: { contains: query.city.trim(), mode: "insensitive" } } : {}),
          ...(query.district ? { district: { contains: query.district.trim(), mode: "insensitive" } } : {}),
        },
      },
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search.trim(), mode: "insensitive" } },
              { description: { contains: query.search.trim(), mode: "insensitive" } },
              { room: { title: { contains: query.search.trim(), mode: "insensitive" } } },
              { room: { property: { name: { contains: query.search.trim(), mode: "insensitive" } } } },
              { room: { property: { address: { contains: query.search.trim(), mode: "insensitive" } } } },
            ],
          }
        : {}),
      ...(amenityIds.length
        ? {
            AND: amenityIds.map((amenityId) => ({
              room: { amenities: { some: { amenityId } } },
            })),
          }
        : {}),
    };
  }

  private publicOrder(sort: PublicListingSort): Prisma.ListingOrderByWithRelationInput[] {
    switch (sort) {
      case "price_asc":
        return [{ isVip: "desc" }, { room: { price: "asc" } }, { publishedAt: "desc" }];
      case "price_desc":
        return [{ isVip: "desc" }, { room: { price: "desc" } }, { publishedAt: "desc" }];
      case "area_desc":
        return [{ isVip: "desc" }, { room: { areaM2: "desc" } }, { publishedAt: "desc" }];
      case "popular":
        return [{ isVip: "desc" }, { viewCount: "desc" }, { publishedAt: "desc" }];
      case "distance":
      case "newest":
      default:
        return [{ isVip: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }];
    }
  }

  private async nearbyProperties(lat: number, lng: number, radiusKm: number) {
    const radiusM = radiusKm * 1000;
    return this.prisma.$transaction(async (tx) => {
      // Supabase commonly installs PostGIS in `extensions`, while local Docker
      // installs it in `public`. The transaction-local search_path supports both.
      await tx.$executeRawUnsafe('SET LOCAL search_path TO public, extensions');
      return tx.$queryRaw<NearbyPropertyRow[]>(Prisma.sql`
        SELECT
          p.id::text AS "propertyId",
          ST_Distance(
            p.location,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
          )::double precision AS "distanceM"
        FROM properties p
        WHERE p.location IS NOT NULL
          AND ST_DWithin(
            p.location,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radiusM}
          )
        ORDER BY "distanceM" ASC
        LIMIT 2000
      `);
    });
  }

  async listPublic(query: ListPublicListingsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 12;
    const hasLat = query.lat !== undefined;
    const hasLng = query.lng !== undefined;

    if (hasLat !== hasLng) {
      throw new BadRequestException("Muốn tìm quanh vị trí, hãy gửi đồng thời lat và lng.");
    }
    if (query.sort === "distance" && !hasLat) {
      throw new BadRequestException("Sắp xếp theo khoảng cách cần lat và lng.");
    }

    let distanceMap: Map<string, number> | null = null;
    let nearbyPropertyIds: string[] | undefined;

    if (hasLat && hasLng) {
      const nearby = await this.nearbyProperties(query.lat as number, query.lng as number, query.radiusKm || 10);
      nearbyPropertyIds = nearby.map((item) => item.propertyId);
      distanceMap = new Map(nearby.map((item) => [item.propertyId, item.distanceM]));

      if (!nearbyPropertyIds.length) {
        return {
          listings: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          location: { lat: query.lat, lng: query.lng, radiusKm: query.radiusKm || 10 },
        };
      }
    }

    const where = this.buildPublicWhere(query, nearbyPropertyIds);
    const total = await this.prisma.listing.count({ where });

    if (query.sort === "distance" && distanceMap) {
      const allNearbyMatches = await this.prisma.listing.findMany({
        where,
        take: 2000,
        include: listingInclude,
      });

      allNearbyMatches.sort((a, b) => {
        if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
        const distanceA = distanceMap?.get(a.room.property.id) ?? Number.POSITIVE_INFINITY;
        const distanceB = distanceMap?.get(b.room.property.id) ?? Number.POSITIVE_INFINITY;
        return distanceA - distanceB;
      });

      const start = (page - 1) * limit;
      const sliced = allNearbyMatches.slice(start, start + limit).map((listing) => ({
        ...listing,
        distanceKm: Number(((distanceMap?.get(listing.room.property.id) ?? 0) / 1000).toFixed(2)),
      }));

      return {
        listings: sliced,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        location: { lat: query.lat, lng: query.lng, radiusKm: query.radiusKm || 10 },
      };
    }

    const listings = await this.prisma.listing.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: this.publicOrder(query.sort || "newest"),
      include: listingInclude,
    });

    const enriched = distanceMap
      ? listings.map((listing) => ({
          ...listing,
          distanceKm: Number(((distanceMap?.get(listing.room.property.id) ?? 0) / 1000).toFixed(2)),
        }))
      : listings;

    return {
      listings: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      ...(hasLat && hasLng ? { location: { lat: query.lat, lng: query.lng, radiusKm: query.radiusKm || 10 } } : {}),
    };
  }

  async publicDetail(id: string) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id,
        status: ListingStatus.APPROVED,
        room: { status: RoomStatus.AVAILABLE, property: { status: PropertyStatus.ACTIVE } },
      },
      include: listingInclude,
    });
    if (!listing) throw new NotFoundException("Tin đăng không tồn tại hoặc chưa được công khai.");

    const price = Number(listing.room.price);
    const similarListings = await this.prisma.listing.findMany({
      where: {
        id: { not: id },
        status: ListingStatus.APPROVED,
        room: {
          status: RoomStatus.AVAILABLE,
          price: { gte: Math.max(0, price * 0.7), lte: price * 1.3 },
          property: {
            status: PropertyStatus.ACTIVE,
            district: { equals: listing.room.property.district, mode: "insensitive" },
            city: { equals: listing.room.property.city, mode: "insensitive" },
          },
        },
      },
      take: 4,
      orderBy: [{ isVip: "desc" }, { publishedAt: "desc" }],
      include: listingInclude,
    });

    await this.prisma.listing.update({ where: { id }, data: { viewCount: { increment: 1 } } });

    return {
      ...listing,
      viewCount: listing.viewCount + 1,
      similarListings,
    };
  }

  async openImage(filename: string) {
    if (!filename || basename(filename) !== filename || !/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)) {
      throw new NotFoundException("Ảnh không tồn tại.");
    }

    const path = join(this.uploadDir, filename);
    await access(path).catch(() => {
      throw new NotFoundException("Ảnh không tồn tại.");
    });

    const extension = extname(filename).toLowerCase();
    const contentType = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
    return { stream: createReadStream(path), contentType };
  }
}
