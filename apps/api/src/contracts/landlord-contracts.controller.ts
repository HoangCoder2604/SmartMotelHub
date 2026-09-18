import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole, type User } from "../generated/prisma/client.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { FirebaseAuthGuard } from "../auth/guards/firebase-auth.guard.js";
import { RegisteredUserGuard } from "../auth/guards/registered-user.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { VerifiedEmailGuard } from "../auth/guards/verified-email.guard.js";
import { ContractsService } from "./contracts.service.js";
import { CreateContractDto } from "./dto/create-contract.dto.js";
import { RenewContractDto } from "./dto/renew-contract.dto.js";
import { TerminateContractDto } from "./dto/terminate-contract.dto.js";

@Controller("landlord/contracts")
@Roles(UserRole.LANDLORD)
@UseGuards(FirebaseAuthGuard, RegisteredUserGuard, RolesGuard)
export class LandlordContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return { success: true, data: await this.contractsService.listLandlord(user.id) };
  }

  @Post()
  @UseGuards(VerifiedEmailGuard)
  async create(@CurrentUser() user: User, @Body() dto: CreateContractDto) {
    return {
      success: true,
      data: { contract: await this.contractsService.createDraft(user.id, dto) },
    };
  }

  @Delete(":id")
  async deleteDraft(@CurrentUser() user: User, @Param("id") id: string) {
    return { success: true, data: await this.contractsService.deleteDraft(user.id, id) };
  }

  @Patch(":id/renew")
  @UseGuards(VerifiedEmailGuard)
  async renew(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: RenewContractDto,
  ) {
    return {
      success: true,
      data: { contract: await this.contractsService.renew(user.id, id, dto) },
    };
  }

  @Patch(":id/terminate")
  async terminate(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: TerminateContractDto,
  ) {
    return {
      success: true,
      data: { contract: await this.contractsService.terminate(user.id, id, dto) },
    };
  }
}
