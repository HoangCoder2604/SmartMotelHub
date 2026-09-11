import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RegisterPushDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token!: string;
}
