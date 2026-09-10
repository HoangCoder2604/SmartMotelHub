import { Controller, Get, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { InvoicesService } from "./invoices.service.js";

@Controller("invoices")
@Roles(UserRole.TENANT)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return {
      success: true,
      data: { invoices: await this.invoicesService.listTenant(user.id) },
    };
  }
}
