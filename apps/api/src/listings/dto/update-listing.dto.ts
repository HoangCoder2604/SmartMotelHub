import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @MaxLength(220)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  description?: string;
}
