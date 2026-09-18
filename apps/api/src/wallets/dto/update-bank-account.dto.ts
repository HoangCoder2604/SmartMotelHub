import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  bankCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  bankName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  accountNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  accountHolderName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  branch?: string;
}
