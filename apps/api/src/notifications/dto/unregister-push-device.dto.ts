import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class UnregisterPushDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token!: string;
}
