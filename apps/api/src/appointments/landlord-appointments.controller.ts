import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { AppointmentsService } from "./appointments.service.js";
import { RejectAppointmentDto } from "./dto/reject-appointment.dto.js";

@Controller("landlord/appointments")
@Roles(UserRole.LANDLORD)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class LandlordAppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return {
      success: true,
      data: { appointments: await this.appointmentsService.listLandlord(user.id) },
    };
  }

  @Patch(":id/confirm")
  async confirm(@CurrentUser() user: User, @Param("id") id: string) {
    return {
      success: true,
      data: { appointment: await this.appointmentsService.confirm(user.id, id) },
    };
  }

  @Patch(":id/reject")
  async reject(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: RejectAppointmentDto,
  ) {
    return {
      success: true,
      data: { appointment: await this.appointmentsService.reject(user.id, id, dto) },
    };
  }

  @Patch(":id/complete")
  async complete(@CurrentUser() user: User, @Param("id") id: string) {
    return {
      success: true,
      data: { appointment: await this.appointmentsService.complete(user.id, id) },
    };
  }

  @Patch(":id/no-show")
  async noShow(@CurrentUser() user: User, @Param("id") id: string) {
    return {
      success: true,
      data: { appointment: await this.appointmentsService.noShow(user.id, id) },
    };
  }
}
