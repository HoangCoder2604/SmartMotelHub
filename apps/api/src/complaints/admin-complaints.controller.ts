import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { ComplaintsService } from "./complaints.service.js";
import { ListAdminComplaintsQueryDto } from "./dto/list-admin-complaints-query.dto.js";
import { ResolveComplaintDto } from "./dto/resolve-complaint.dto.js";

@Controller("admin/complaints")
@Roles(UserRole.ADMIN)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, VerifiedEmailGuard, RolesGuard)
export class AdminComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  @Get("stats")
  async stats() {
    return { success: true, data: await this.complaintsService.adminStats() };
  }

  @Get()
  async list(@Query() query: ListAdminComplaintsQueryDto) {
    return { success: true, data: await this.complaintsService.listAdmin(query) };
  }

  @Patch(":id/investigate")
  async investigate(@CurrentUser() admin: User, @Param("id") id: string) {
    return {
      success: true,
      data: { complaint: await this.complaintsService.investigate(id, admin.id) },
      message: "Đã nhận xử lý báo cáo.",
    };
  }

  @Patch(":id/resolve")
  async resolve(@CurrentUser() admin: User, @Param("id") id: string, @Body() dto: ResolveComplaintDto) {
    return {
      success: true,
      data: { complaint: await this.complaintsService.resolve(id, admin.id, dto) },
      message: "Đã giải quyết báo cáo.",
    };
  }

  @Patch(":id/reject")
  async reject(@CurrentUser() admin: User, @Param("id") id: string, @Body() dto: ResolveComplaintDto) {
    return {
      success: true,
      data: { complaint: await this.complaintsService.reject(id, admin.id, dto) },
      message: "Đã bác bỏ báo cáo.",
    };
  }
}
