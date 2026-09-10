import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { CreateInvoiceDto } from "./dto/create-invoice.dto.js";
import { MarkInvoicePaidDto } from "./dto/mark-invoice-paid.dto.js";
import { InvoicesService } from "./invoices.service.js";

@Controller("landlord")
@Roles(UserRole.LANDLORD)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class LandlordInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get("invoices")
  async list(@CurrentUser() user: User) {
    return {
      success: true,
      data: { invoices: await this.invoicesService.listLandlord(user.id) },
    };
  }

  @Post("contracts/:contractId/invoices")
  @UseGuards(VerifiedEmailGuard)
  async create(
    @CurrentUser() user: User,
    @Param("contractId") contractId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return {
      success: true,
      data: { invoice: await this.invoicesService.create(user.id, contractId, dto) },
    };
  }

  @Patch("invoices/:id/paid")
  async markPaid(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: MarkInvoicePaidDto,
  ) {
    return {
      success: true,
      data: { invoice: await this.invoicesService.markPaid(user.id, id, dto) },
    };
  }
}
