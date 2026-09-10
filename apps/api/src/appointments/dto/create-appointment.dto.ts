import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class CreateAppointmentDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "appointmentDate phải có dạng YYYY-MM-DD." })
  appointmentDate!: string;

  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, { message: "startTime phải có dạng HH:mm." })
  startTime!: string;

  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, { message: "endTime phải có dạng HH:mm." })
  endTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  tenantNote?: string;
}
