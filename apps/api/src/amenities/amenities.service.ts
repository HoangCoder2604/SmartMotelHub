import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class AmenitiesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.amenity.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }
}
