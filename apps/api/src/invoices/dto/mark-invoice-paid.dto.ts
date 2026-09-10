import { IsOptional, IsString, MaxLength } from "class-validator";

export class MarkInvoicePaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  paymentNote?: string;
}
