import { Controller, Get, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { PaymentsService } from "./payments.service.js";

@Controller("landlord/payments")
@Roles(UserRole.LANDLORD)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class LandlordPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return { success: true, data: { payments: await this.paymentsService.listLandlord(user.id) } };
  }
}
