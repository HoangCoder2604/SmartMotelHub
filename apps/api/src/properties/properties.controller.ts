import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { CreatePropertyDto } from "./dto/create-property.dto.js";
import { UpdatePropertyDto } from "./dto/update-property.dto.js";
import { PropertiesService } from "./properties.service.js";

@Controller("properties")
@Roles(UserRole.LANDLORD)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get("mine")
  async mine(@CurrentUser() user: User) {
    const properties = await this.propertiesService.listMine(user.id);
    return { success: true, data: { properties } };
  }

  @Get(":id")
  async detail(@CurrentUser() user: User, @Param("id") id: string) {
    const property = await this.propertiesService.getMineOrThrow(id, user.id);
    return { success: true, data: { property } };
  }

  @Post()
  @UseGuards(VerifiedEmailGuard)
  async create(@CurrentUser() user: User, @Body() dto: CreatePropertyDto) {
    const property = await this.propertiesService.create(user.id, dto);
    return { success: true, data: { property } };
  }

  @Patch(":id")
  @UseGuards(VerifiedEmailGuard)
  async update(@CurrentUser() user: User, @Param("id") id: string, @Body() dto: UpdatePropertyDto) {
    const property = await this.propertiesService.update(id, user.id, dto);
    return { success: true, data: { property } };
  }

  @Delete(":id")
  @UseGuards(VerifiedEmailGuard)
  async archive(@CurrentUser() user: User, @Param("id") id: string) {
    const property = await this.propertiesService.archive(id, user.id);
    return { success: true, data: { property } };
  }

  @Patch(":id/reactivate")
  @UseGuards(VerifiedEmailGuard)
  async reactivate(@CurrentUser() user: User, @Param("id") id: string) {
    const property = await this.propertiesService.reactivate(id, user.id);
    return { success: true, data: { property } };
  }
}
