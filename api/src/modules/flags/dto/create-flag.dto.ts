import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export type FlagType = 'boolean' | 'string' | 'number' | 'json';

export class CreateFlagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, {
    message: 'key must be lowercase, alphanumeric and underscore-separated',
  })
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsIn(['boolean', 'string', 'number', 'json'])
  @IsOptional()
  type?: FlagType;
}
