import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class ApproveWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  transferReference!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}
