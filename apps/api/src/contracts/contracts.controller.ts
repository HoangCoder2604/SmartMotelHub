import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { ContractsService } from "./contracts.service.js";

@Controller("contracts")
@Roles(UserRole.TENANT)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return {
      success: true,
      data: { contracts: await this.contractsService.listTenant(user.id) },
    };
  }

  @Patch(":id/accept")
  @UseGuards(VerifiedEmailGuard)
  async accept(@CurrentUser() user: User, @Param("id") id: string) {
    return {
      success: true,
      data: { contract: await this.contractsService.accept(user.id, id) },
    };
  }
}
