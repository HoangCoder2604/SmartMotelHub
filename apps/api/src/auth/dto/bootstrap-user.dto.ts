import { IsIn, IsOptional, IsString, Length } from "class-validator";

export class BootstrapUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 150)
  fullName?: string;

  @IsOptional()
  @IsIn(["TENANT", "LANDLORD"])
  role?: "TENANT" | "LANDLORD";
}
