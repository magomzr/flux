import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateFlagValueDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  value?: string; // JSON serializado — el cliente es responsable del formato

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  rolloutPct?: number;
}
