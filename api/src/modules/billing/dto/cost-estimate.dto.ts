import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CostEstimateDto {
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  evaluationsMonth?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sseConnectionsMax?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  assetStorageMb?: number;
}
