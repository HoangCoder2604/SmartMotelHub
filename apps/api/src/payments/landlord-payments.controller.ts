import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { ListPaymentsQueryDto } from "./dto/list-payments-query.dto.js";
import { PaymentsService } from "./payments.service.js";

@Controller("landlord/payments")
@Roles(UserRole.LANDLORD)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class LandlordPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  async list(@CurrentUser() user: User, @Query() query: ListPaymentsQueryDto) {
    return { success: true, data: await this.paymentsService.listLandlord(user.id, query.page, query.limit) };
  }
}
