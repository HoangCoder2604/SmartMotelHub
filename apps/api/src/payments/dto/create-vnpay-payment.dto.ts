import { IsOptional, Matches } from "class-validator";

export class CreateVnpayPaymentDto {
  @IsOptional()
  @Matches(/^[A-Z0-9]{2,20}$/, { message: "bankCode không hợp lệ." })
  bankCode?: string;
}
