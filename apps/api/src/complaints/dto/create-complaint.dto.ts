import { IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export const COMPLAINT_TYPES = [
  "MISLEADING",
  "FRAUD",
  "WRONG_PRICE",
  "INAPPROPRIATE",
  "SAFETY",
  "OTHER",
] as const;

export class CreateComplaintDto {
  @IsString()
  @IsIn(COMPLAINT_TYPES)
  type!: (typeof COMPLAINT_TYPES)[number];

  @IsString()
  @MinLength(20, { message: "Mô tả khiếu nại phải có ít nhất 20 ký tự." })
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true }, { message: "evidenceUrl phải là URL hợp lệ có http/https." })
  @MaxLength(2000)
  evidenceUrl?: string;
}
