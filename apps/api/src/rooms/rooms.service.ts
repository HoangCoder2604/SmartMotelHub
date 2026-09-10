import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { CreateRoomDto } from "./dto/create-room.dto.js";
import { UpdateRoomDto } from "./dto/update-room.dto.js";

const roomInclude = {
  amenities: { include: { amenity: true } },
  listings: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: { images: { orderBy: { sortOrder: "asc" as const } } },
  },
};

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertPropertyOwner(propertyId: string, landlordId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, landlordId },
      select: { id: true },
    });
    if (!property) throw new NotFoundException("Không tìm thấy nhà trọ hoặc bạn không phải chủ sở hữu.");
  }

  async getMineOrThrow(id: string, landlordId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, property: { landlordId } },
      include: { property: { select: { landlordId: true } }, ...roomInclude },
    });
    if (!room) throw new NotFoundException("Không tìm thấy phòng hoặc bạn không phải chủ sở hữu.");
    return room;
  }

  private async validateAmenities(amenityIds: string[]) {
    const uniqueIds = [...new Set(amenityIds)];
    if (!uniqueIds.length) return uniqueIds;
    const count = await this.prisma.amenity.count({ where: { id: { in: uniqueIds } } });
    if (count !== uniqueIds.length) throw new BadRequestException("Có tiện ích không tồn tại.");
    return uniqueIds;
  }

  async create(propertyId: string, landlordId: string, dto: CreateRoomDto) {
    await this.assertPropertyOwner(propertyId, landlordId);
    const amenityIds = await this.validateAmenities(dto.amenityIds ?? []);

    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          propertyId,
          roomNumber: dto.roomNumber?.trim() || null,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          price: dto.price,
          deposit: dto.deposit ?? null,
          areaM2: dto.areaM2,
          electricityPrice: dto.electricityPrice ?? null,
          waterPrice: dto.waterPrice ?? null,
          internetPrice: dto.internetPrice ?? null,
          serviceFee: dto.serviceFee ?? null,
          maxOccupants: dto.maxOccupants,
          hasMezzanine: dto.hasMezzanine,
        },
      });

      if (amenityIds.length) {
        await tx.roomAmenity.createMany({
          data: amenityIds.map((amenityId) => ({ roomId: room.id, amenityId })),
          skipDuplicates: true,
        });
      }

      return tx.room.findUniqueOrThrow({ where: { id: room.id }, include: roomInclude });
    });
  }

  async update(id: string, landlordId: string, dto: UpdateRoomDto) {
    await this.getMineOrThrow(id, landlordId);
    const amenityIds = dto.amenityIds === undefined ? undefined : await this.validateAmenities(dto.amenityIds);

    return this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id },
        data: {
          ...(dto.roomNumber !== undefined ? { roomNumber: dto.roomNumber.trim() || null } : {}),
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.deposit !== undefined ? { deposit: dto.deposit } : {}),
          ...(dto.areaM2 !== undefined ? { areaM2: dto.areaM2 } : {}),
          ...(dto.electricityPrice !== undefined ? { electricityPrice: dto.electricityPrice } : {}),
          ...(dto.waterPrice !== undefined ? { waterPrice: dto.waterPrice } : {}),
          ...(dto.internetPrice !== undefined ? { internetPrice: dto.internetPrice } : {}),
          ...(dto.serviceFee !== undefined ? { serviceFee: dto.serviceFee } : {}),
          ...(dto.maxOccupants !== undefined ? { maxOccupants: dto.maxOccupants } : {}),
          ...(dto.hasMezzanine !== undefined ? { hasMezzanine: dto.hasMezzanine } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      if (amenityIds !== undefined) {
        await tx.roomAmenity.deleteMany({ where: { roomId: id } });
        if (amenityIds.length) {
          await tx.roomAmenity.createMany({
            data: amenityIds.map((amenityId) => ({ roomId: id, amenityId })),
            skipDuplicates: true,
          });
        }
      }

      return tx.room.findUniqueOrThrow({ where: { id }, include: roomInclude });
    });
  }
}
