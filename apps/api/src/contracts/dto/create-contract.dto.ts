import { IsNumber, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from "class-validator";

export class CreateContractDto {
  @IsUUID()
  appointmentId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "startDate phải có dạng YYYY-MM-DD." })
  startDate!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "endDate phải có dạng YYYY-MM-DD." })
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyRent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deposit?: number;
}
