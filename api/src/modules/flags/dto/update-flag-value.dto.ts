import {
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateFlagValueDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  value?: string; // JSON serializado — el cliente es responsable del formato
}
