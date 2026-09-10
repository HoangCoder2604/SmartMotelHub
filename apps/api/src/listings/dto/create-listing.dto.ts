import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  description?: string;
}
