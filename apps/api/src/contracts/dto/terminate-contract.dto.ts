import { IsOptional, IsString, MaxLength } from "class-validator";

export class TerminateContractDto {
  @IsOptional()
  @IsString()
  @MaxLength(1500)
  reason?: string;
}
