import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { AdminPaymentsController } from "./admin-payments.controller.js";
import { LandlordPaymentsController } from "./landlord-payments.controller.js";
import { PaymentGatewayController } from "./payment-gateway.controller.js";
import { PaymentsController } from "./payments.controller.js";
import { PaymentsService } from "./payments.service.js";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [
    PaymentsController,
    LandlordPaymentsController,
    AdminPaymentsController,
    PaymentGatewayController,
  ],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
