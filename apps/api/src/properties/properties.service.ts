import { Injectable, NotFoundException } from "@nestjs/common";
import { PropertyStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import { CreatePropertyDto } from "./dto/create-property.dto.js";
import { UpdatePropertyDto } from "./dto/update-property.dto.js";

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(landlordId: string) {
    return this.prisma.property.findMany({
      where: { landlordId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { rooms: true } } },
    });
  }

  async getMineOrThrow(id: string, landlordId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, landlordId },
      include: {
        rooms: {
          orderBy: { createdAt: "desc" },
          include: {
            amenities: { include: { amenity: true } },
            listings: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { images: { orderBy: { sortOrder: "asc" } } },
            },
          },
        },
      },
    });

    if (!property) throw new NotFoundException("Không tìm thấy nhà trọ hoặc bạn không phải chủ sở hữu.");
    return property;
  }

  create(landlordId: string, dto: CreatePropertyDto) {
    return this.prisma.property.create({
      data: {
        landlordId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        address: dto.address.trim(),
        ward: dto.ward?.trim() || null,
        district: dto.district.trim(),
        city: dto.city.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
    });
  }

  async update(id: string, landlordId: string, dto: UpdatePropertyDto) {
    await this.getMineOrThrow(id, landlordId);
    return this.prisma.property.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
        ...(dto.ward !== undefined ? { ward: dto.ward.trim() || null } : {}),
        ...(dto.district !== undefined ? { district: dto.district.trim() } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      },
    });
  }

  async archive(id: string, landlordId: string) {
    await this.getMineOrThrow(id, landlordId);
    return this.prisma.property.update({
      where: { id },
      data: { status: PropertyStatus.INACTIVE },
    });
  }
}
