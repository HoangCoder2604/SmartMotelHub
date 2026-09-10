import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { CreateRoomDto } from "./dto/create-room.dto.js";
import { UpdateRoomDto } from "./dto/update-room.dto.js";
import { RoomsService } from "./rooms.service.js";

@Controller()
@Roles(UserRole.LANDLORD)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard, VerifiedEmailGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post("properties/:propertyId/rooms")
  async create(@CurrentUser() user: User, @Param("propertyId") propertyId: string, @Body() dto: CreateRoomDto) {
    const room = await this.roomsService.create(propertyId, user.id, dto);
    return { success: true, data: { room } };
  }

  @Patch("rooms/:id")
  async update(@CurrentUser() user: User, @Param("id") id: string, @Body() dto: UpdateRoomDto) {
    const room = await this.roomsService.update(id, user.id, dto);
    return { success: true, data: { room } };
  }
}
