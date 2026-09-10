import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AppointmentsController } from "./appointments.controller.js";
import { AppointmentsService } from "./appointments.service.js";
import { LandlordAppointmentsController } from "./landlord-appointments.controller.js";

@Module({
  imports: [AuthModule],
  controllers: [AppointmentsController, LandlordAppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
