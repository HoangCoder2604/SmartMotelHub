import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./database/prisma.service.js";

type HealthRow = {
  current_time: Date;
  postgis_version: string;
};

@Controller("health")
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    const rows = await this.prisma.$queryRaw<HealthRow[]>`
      SELECT NOW() AS current_time, PostGIS_Version() AS postgis_version
    `;

    const row = rows[0];
    return {
      success: true,
      data: {
        api: "ok",
        database: "ok",
        postgisVersion: row?.postgis_version ?? "unknown",
        timestamp: row?.current_time?.toISOString() ?? new Date().toISOString(),
      },
    };
  }
}
