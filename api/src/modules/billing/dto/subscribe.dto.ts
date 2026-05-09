import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class SubscribeDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['starter', 'studio', 'scale'])
  planId!: string;
}
