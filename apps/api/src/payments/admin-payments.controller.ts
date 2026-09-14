import { Controller, Get, UseGuards } from "@nestjs/common";
import { UserRole } from "../generated/prisma/client.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { PaymentsService } from "./payments.service.js";

@Controller("admin/payments")
@Roles(UserRole.ADMIN)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  async list() {
    return { success: true, data: { payments: await this.paymentsService.listAdmin() } };
  }
}
