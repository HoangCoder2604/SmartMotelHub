import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { AdminWithdrawalsController } from "./admin-withdrawals.controller.js";
import { LandlordWalletController } from "./landlord-wallet.controller.js";
import { WalletsService } from "./wallets.service.js";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [LandlordWalletController, AdminWithdrawalsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}
