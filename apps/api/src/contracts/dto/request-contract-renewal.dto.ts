import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class RequestContractRenewalDto {
  @IsString()
  @IsIn(["RENEW", "NOT_RENEW"])
  intent!: "RENEW" | "NOT_RENEW";

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  note?: string;
}
