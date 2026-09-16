import { Body, Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { CreateVnpayPaymentDto } from "./dto/create-vnpay-payment.dto.js";
import { ListPaymentsQueryDto } from "./dto/list-payments-query.dto.js";
import { PaymentsService } from "./payments.service.js";

@Controller("payments")
@Roles(UserRole.TENANT)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("invoices/:invoiceId/vnpay")
  async createVnpayCheckout(
    @CurrentUser() user: User,
    @Param("invoiceId", new ParseUUIDPipe()) invoiceId: string,
    @Ip() ipAddress: string,
    @Body() dto: CreateVnpayPaymentDto,
  ) {
    return {
      success: true,
      data: await this.paymentsService.createVnpayCheckout(user.id, invoiceId, ipAddress, dto.bankCode),
    };
  }

  @Get()
  async list(@CurrentUser() user: User, @Query() query: ListPaymentsQueryDto) {
    return { success: true, data: await this.paymentsService.listTenant(user.id, query.page, query.limit) };
  }

  @Delete(":id/history")
  async hideHistory(@CurrentUser() user: User, @Param("id", new ParseUUIDPipe()) id: string) {
    return { success: true, data: await this.paymentsService.hideTenantHistory(user.id, id) };
  }

  @Get("txn/:txnRef")
  async byTxnRef(@CurrentUser() user: User, @Param("txnRef") txnRef: string) {
    return { success: true, data: { payment: await this.paymentsService.getTenantByTxnRef(user.id, txnRef) } };
  }
}
