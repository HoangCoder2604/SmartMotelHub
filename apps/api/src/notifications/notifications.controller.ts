import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto.js";
import { RegisterPushDeviceDto } from "./dto/register-push-device.dto.js";
import { UnregisterPushDeviceDto } from "./dto/unregister-push-device.dto.js";
import { NotificationsService } from "./notifications.service.js";

@Controller("notifications")
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: User, @Query() query: ListNotificationsQueryDto) {
    return { success: true, data: await this.notificationsService.list(user.id, query.page, query.limit) };
  }

  @Get("push/status")
  async pushStatus(@CurrentUser() user: User) {
    return { success: true, data: await this.notificationsService.pushDeviceStatus(user.id) };
  }

  @Post("push/device")
  async registerPushDevice(
    @CurrentUser() user: User,
    @Body() dto: RegisterPushDeviceDto,
    @Headers("user-agent") userAgent?: string,
  ) {
    return {
      success: true,
      data: {
        device: await this.notificationsService.registerPushDevice(user.id, dto.token, userAgent),
      },
    };
  }

  @Delete("push/device")
  async unregisterPushDevice(@CurrentUser() user: User, @Body() dto: UnregisterPushDeviceDto) {
    return {
      success: true,
      data: await this.notificationsService.unregisterPushDevice(user.id, dto.token),
    };
  }

  @Post("push/test")
  async testPush(@CurrentUser() user: User) {
    const notification = await this.notificationsService.notify({
      userId: user.id,
      type: "PUSH_TEST",
      title: "SmartMotel Hub",
      message: "Thông báo đẩy FCM trên thiết bị này đang hoạt động.",
      href: "/notifications",
    });

    return { success: true, data: { notification } };
  }

  @Patch("read-all")
  async markAllRead(@CurrentUser() user: User) {
    return { success: true, data: await this.notificationsService.markAllRead(user.id) };
  }

  @Delete("read")
  async deleteRead(@CurrentUser() user: User) {
    return { success: true, data: await this.notificationsService.deleteRead(user.id) };
  }

  @Delete("all")
  async deleteAll(@CurrentUser() user: User) {
    return { success: true, data: await this.notificationsService.deleteAll(user.id) };
  }

  @Patch(":id/read")
  async markRead(@CurrentUser() user: User, @Param("id") id: string) {
    return {
      success: true,
      data: { notification: await this.notificationsService.markRead(user.id, id) },
    };
  }

  @Delete(":id")
  async deleteOne(@CurrentUser() user: User, @Param("id") id: string) {
    return { success: true, data: await this.notificationsService.deleteOne(user.id, id) };
  }
}
