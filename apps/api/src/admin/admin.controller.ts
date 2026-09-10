import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { AdminService } from "./admin.service.js";
import { ListAdminListingsQueryDto } from "./dto/list-admin-listings-query.dto.js";
import { ListUsersQueryDto } from "./dto/list-users-query.dto.js";
import { RejectListingDto } from "./dto/reject-listing.dto.js";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto.js";

@Controller("admin")
@Roles(UserRole.ADMIN)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, VerifiedEmailGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("stats")
  async stats() {
    return { success: true, data: await this.adminService.stats() };
  }

  @Get("listings")
  async listListings(@Query() query: ListAdminListingsQueryDto) {
    return { success: true, data: await this.adminService.listListings(query) };
  }

  @Get("listings/:id")
  async listingDetail(@Param("id") id: string) {
    return { success: true, data: { listing: await this.adminService.listingDetail(id) } };
  }

  @Patch("listings/:id/approve")
  async approveListing(@Param("id") id: string, @CurrentUser() admin: User) {
    return {
      success: true,
      data: { listing: await this.adminService.approveListing(id, admin.id) },
      message: "Đã duyệt tin đăng.",
    };
  }

  @Patch("listings/:id/reject")
  async rejectListing(@Param("id") id: string, @CurrentUser() admin: User, @Body() dto: RejectListingDto) {
    return {
      success: true,
      data: { listing: await this.adminService.rejectListing(id, admin.id, dto) },
      message: "Đã từ chối tin đăng.",
    };
  }

  @Get("users")
  async listUsers(@Query() query: ListUsersQueryDto) {
    return { success: true, data: await this.adminService.listUsers(query) };
  }

  @Patch("users/:id/status")
  async updateUserStatus(@Param("id") id: string, @CurrentUser() admin: User, @Body() dto: UpdateUserStatusDto) {
    return {
      success: true,
      data: { user: await this.adminService.updateUserStatus(id, admin.id, dto) },
      message: "Đã cập nhật trạng thái người dùng.",
    };
  }
}
