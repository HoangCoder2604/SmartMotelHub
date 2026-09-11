import { IsString, MaxLength, MinLength } from "class-validator";

export class ResolveComplaintDto {
  @IsString()
  @MinLength(5, { message: "Ghi chú xử lý phải có ít nhất 5 ký tự." })
  @MaxLength(3000)
  adminNote!: string;
}
