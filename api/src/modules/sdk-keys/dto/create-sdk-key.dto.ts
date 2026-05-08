import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
} from 'class-validator';

export class CreateSdkKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string; // label descriptivo: "Android prod key"

  @IsDateString()
  @IsOptional()
  expiresAt?: string; // ISO 8601 — null = no expira
}
