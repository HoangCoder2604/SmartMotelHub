import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class RenewContractDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "newEndDate phải có dạng YYYY-MM-DD." })
  newEndDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  note?: string;
}
