import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { AdminComplaintsController } from "./admin-complaints.controller.js";
import { ComplaintsController } from "./complaints.controller.js";
import { ComplaintsService } from "./complaints.service.js";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ComplaintsController, AdminComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
