import { Controller, Get, Query, Redirect } from "@nestjs/common";
import { PaymentsService } from "./payments.service.js";

@Controller("payments/vnpay")
export class PaymentGatewayController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("return")
  @Redirect()
  async returnFromVnpay(@Query() query: Record<string, string | string[] | undefined>) {
    const result = await this.paymentsService.handleVnpayReturn(query);
    return { url: result.redirectUrl, statusCode: 302 };
  }

  @Get("ipn")
  async ipn(@Query() query: Record<string, string | string[] | undefined>) {
    return this.paymentsService.handleVnpayIpn(query);
  }
}
