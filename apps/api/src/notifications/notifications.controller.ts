import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { NotificationsService } from "./notifications.service.js";

@Controller("notifications")
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return { success: true, data: await this.notificationsService.list(user.id) };
  }

  @Patch("read-all")
  async markAllRead(@CurrentUser() user: User) {
    return { success: true, data: await this.notificationsService.markAllRead(user.id) };
  }

  @Patch(":id/read")
  async markRead(@CurrentUser() user: User, @Param("id") id: string) {
    return {
      success: true,
      data: { notification: await this.notificationsService.markRead(user.id, id) },
    };
  }
}
