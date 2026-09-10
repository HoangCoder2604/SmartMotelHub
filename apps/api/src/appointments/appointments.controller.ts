import { Controller, Get, Param, Patch, Post, Body, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { AppointmentsService } from "./appointments.service.js";
import { CreateAppointmentDto } from "./dto/create-appointment.dto.js";

@Controller("appointments")
@Roles(UserRole.TENANT)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return { success: true, data: await this.appointmentsService.listTenant(user.id) };
  }

  @Post("listings/:listingId")
  @UseGuards(VerifiedEmailGuard)
  async create(
    @CurrentUser() user: User,
    @Param("listingId") listingId: string,
    @Body() dto: CreateAppointmentDto,
  ) {
    return {
      success: true,
      data: {
        appointment: await this.appointmentsService.createForListing(user.id, listingId, dto),
      },
    };
  }

  @Patch(":id/cancel")
  async cancel(@CurrentUser() user: User, @Param("id") id: string) {
    return {
      success: true,
      data: { appointment: await this.appointmentsService.cancel(user.id, id) },
    };
  }
}
