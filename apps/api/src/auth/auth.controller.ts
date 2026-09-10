import { Body, Controller, Get, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { AuthService } from "./auth.service.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { Roles } from "./decorators/roles.decorator.js";
import { BootstrapUserDto } from "./dto/bootstrap-user.dto.js";
import { UpdateProfileDto } from "./dto/update-profile.dto.js";
import { FirebaseAuthGuard } from "./guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "./guards/registered-user.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";
import type { AuthRequest } from "./types/auth-request.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("bootstrap")
  @UseGuards(FirebaseAuthGuard)
  async bootstrap(@Req() request: AuthRequest, @Body() dto: BootstrapUserDto) {
    const user = await this.authService.bootstrapUser(request.firebaseUser!, dto);
    return { success: true, data: { user } };
  }

  @Post("sync-verification")
  @UseGuards(FirebaseAuthGuard, RegisteredUserGuard)
  async syncVerification(@Req() request: AuthRequest, @CurrentUser() user: User) {
    const updated = await this.authService.syncVerification(user.id, request.firebaseUser!);
    return { success: true, data: { user: updated } };
  }

  @Get("me")
  @UseGuards(FirebaseAuthGuard, RegisteredUserGuard)
  me(@CurrentUser() user: User) {
    return { success: true, data: { user } };
  }

  @Patch("me")
  @UseGuards(FirebaseAuthGuard, RegisteredUserGuard)
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    const updated = await this.authService.updateProfile(user.id, dto);
    return { success: true, data: { user: updated } };
  }

  @Get("access/tenant")
  @Roles(UserRole.TENANT)
  @UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
  tenantAccess(@CurrentUser() user: User) {
    return { success: true, data: { role: user.role, access: "TENANT_OK" } };
  }

  @Get("access/landlord")
  @Roles(UserRole.LANDLORD)
  @UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
  landlordAccess(@CurrentUser() user: User) {
    return { success: true, data: { role: user.role, access: "LANDLORD_OK" } };
  }

  @Get("access/admin")
  @Roles(UserRole.ADMIN)
  @UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
  adminAccess(@CurrentUser() user: User) {
    return { success: true, data: { role: user.role, access: "ADMIN_OK" } };
  }
}
