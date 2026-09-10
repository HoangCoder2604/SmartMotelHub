import { IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";

export class CreateInvoiceDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: "billingMonth phải có dạng YYYY-MM." })
  billingMonth!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "dueDate phải có dạng YYYY-MM-DD." })
  dueDate!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  roomFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  electricityFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  waterFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  internetFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otherFee?: number;
}
