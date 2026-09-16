import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required");

    const configuredMax = Number(process.env.DATABASE_POOL_MAX ?? 2);
    const max = Number.isFinite(configuredMax) ? Math.min(5, Math.max(1, Math.floor(configuredMax))) : 2;

    const adapter = new PrismaPg({
      connectionString,
      max,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 8_000,
      keepAlive: true,
    });

    // Prisma connects lazily on the first query. Avoiding an eager $connect()
    // reduces NestJS/Vercel cold-start work while still using Supabase pooling.
    super({ adapter });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
