import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ContractsController } from "./contracts.controller.js";
import { ContractsService } from "./contracts.service.js";
import { LandlordContractsController } from "./landlord-contracts.controller.js";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [ContractsController, LandlordContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
