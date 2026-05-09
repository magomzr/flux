import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['starter', 'studio', 'scale'])
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  maxFlags?: number | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  maxProjects?: number | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  maxEnvironments?: number | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  maxEvaluationsMonth?: number | null;

  @IsInt()
  @Min(0)
  @IsOptional()
  maxAssetStorageMb?: number | null;

  @IsBoolean()
  @IsOptional()
  hasSse?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  pollIntervalSeconds?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  priceUsd?: number; // en centavos
}
