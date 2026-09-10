import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { InvoicesController } from "./invoices.controller.js";
import { InvoicesService } from "./invoices.service.js";
import { LandlordInvoicesController } from "./landlord-invoices.controller.js";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [InvoicesController, LandlordInvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
