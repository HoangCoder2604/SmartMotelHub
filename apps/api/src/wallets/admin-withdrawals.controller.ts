import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";
import { UserRole, WithdrawalStatus, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { ApproveWithdrawalDto } from "./dto/approve-withdrawal.dto.js";
import { RejectWithdrawalDto } from "./dto/reject-withdrawal.dto.js";
import { WalletsService } from "./wallets.service.js";

@Controller("admin/withdrawals")
@Roles(UserRole.ADMIN)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard, VerifiedEmailGuard)
export class AdminWithdrawalsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  async list(@Query("status") rawStatus?: string) {
    const status = rawStatus && Object.values(WithdrawalStatus).includes(rawStatus as WithdrawalStatus)
      ? rawStatus as WithdrawalStatus
      : undefined;
    return { success: true, data: await this.walletsService.listAdminWithdrawals(status) };
  }

  @Patch(":id/approve")
  async approve(
    @CurrentUser() user: User,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveWithdrawalDto,
  ) {
    return { success: true, data: { withdrawal: await this.walletsService.approveWithdrawal(user.id, id, dto) } };
  }

  @Patch(":id/reject")
  async reject(
    @CurrentUser() user: User,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return { success: true, data: { withdrawal: await this.walletsService.rejectWithdrawal(user.id, id, dto) } };
  }
}
