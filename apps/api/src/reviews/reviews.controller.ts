import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { CreateReviewDto } from "./dto/create-review.dto.js";
import { ReviewsService } from "./reviews.service.js";

@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get("properties/:propertyId")
  async listPublic(@Param("propertyId") propertyId: string) {
    return { success: true, data: await this.reviewsService.listPublic(propertyId) };
  }

  @Get("properties/:propertyId/eligibility")
  @Roles(UserRole.TENANT)
  @UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
  async eligibility(@CurrentUser() user: User, @Param("propertyId") propertyId: string) {
    return { success: true, data: await this.reviewsService.eligibility(user.id, propertyId) };
  }

  @Post("properties/:propertyId")
  @Roles(UserRole.TENANT)
  @UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard, VerifiedEmailGuard)
  async create(
    @CurrentUser() user: User,
    @Param("propertyId") propertyId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return {
      success: true,
      data: { review: await this.reviewsService.create(user.id, propertyId, dto) },
    };
  }
}
