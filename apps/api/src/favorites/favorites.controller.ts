import { Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { FavoritesService } from "./favorites.service.js";

@Controller("favorites")
@Roles(UserRole.TENANT)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return { success: true, data: { favorites: await this.favoritesService.list(user.id) } };
  }

  @Get(":listingId/status")
  async status(@CurrentUser() user: User, @Param("listingId") listingId: string) {
    return { success: true, data: await this.favoritesService.status(user.id, listingId) };
  }

  @Post(":listingId")
  async add(@CurrentUser() user: User, @Param("listingId") listingId: string) {
    return { success: true, data: await this.favoritesService.add(user.id, listingId) };
  }

  @Delete(":listingId")
  async remove(@CurrentUser() user: User, @Param("listingId") listingId: string) {
    return { success: true, data: await this.favoritesService.remove(user.id, listingId) };
  }
}
