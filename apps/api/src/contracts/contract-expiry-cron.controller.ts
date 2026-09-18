import { Controller, Get, Headers, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ContractsService } from "./contracts.service.js";

@Controller("internal/contracts")
export class ContractExpiryCronController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get("expiry")
  async run(@Headers("authorization") authorization?: string) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException("CRON_SECRET chưa được cấu hình cho contract expiry cron.");
    }
    if (authorization !== `Bearer ${secret}`) {
      throw new UnauthorizedException("Cron authorization không hợp lệ.");
    }

    return {
      success: true,
      data: await this.contractsService.processExpiryWorkflow(),
    };
  }
}
