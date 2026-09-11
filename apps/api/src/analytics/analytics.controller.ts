import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { AnalyticsService } from "./analytics.service.js";

function parseMonths(value?: string) {
  const parsed = Number(value ?? "6");
  if (!Number.isInteger(parsed)) return 6;
  return Math.min(12, Math.max(3, parsed));
}

@Controller("analytics")
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("overview")
  async overview(@CurrentUser() user: User, @Query("months") monthsRaw?: string) {
    return {
      success: true,
      data: await this.analyticsService.overview(user, parseMonths(monthsRaw)),
    };
  }
}
