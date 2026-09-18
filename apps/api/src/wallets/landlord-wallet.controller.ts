import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { CreateWithdrawalDto } from "./dto/create-withdrawal.dto.js";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto.js";
import { WalletsService } from "./wallets.service.js";

@Controller("landlord/wallet")
@Roles(UserRole.LANDLORD)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class LandlordWalletController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  async overview(@CurrentUser() user: User) {
    return { success: true, data: await this.walletsService.landlordOverview(user.id) };
  }

  @Put("bank-account")
  @UseGuards(VerifiedEmailGuard)
  async saveBankAccount(@CurrentUser() user: User, @Body() dto: UpdateBankAccountDto) {
    return { success: true, data: { bankAccount: await this.walletsService.upsertBankAccount(user.id, dto) } };
  }

  @Post("withdrawals")
  @UseGuards(VerifiedEmailGuard)
  async withdraw(@CurrentUser() user: User, @Body() dto: CreateWithdrawalDto) {
    return { success: true, data: { withdrawal: await this.walletsService.createWithdrawal(user.id, dto) } };
  }
}
