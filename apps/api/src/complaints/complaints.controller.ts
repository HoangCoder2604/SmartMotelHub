import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { ComplaintsService } from "./complaints.service.js";
import { CreateComplaintDto } from "./dto/create-complaint.dto.js";

@Controller("complaints")
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard)
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Get()
  async listMine(@CurrentUser() user: User) {
    return { success: true, data: { complaints: await this.complaintsService.listMine(user.id) } };
  }

  @Post("listings/:listingId")
  @Roles(UserRole.TENANT, UserRole.LANDLORD)
  @UseGuards(RolesGuard, VerifiedEmailGuard)
  async createForListing(
    @CurrentUser() user: User,
    @Param("listingId") listingId: string,
    @Body() dto: CreateComplaintDto,
  ) {
    return {
      success: true,
      data: { complaint: await this.complaintsService.createForListing(user.id, listingId, dto) },
      message: "Đã gửi báo cáo đến Admin.",
    };
  }
}
