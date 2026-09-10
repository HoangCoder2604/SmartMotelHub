import { IsOptional, IsString, MaxLength } from "class-validator";

export class RejectAppointmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  landlordNote?: string;
}
