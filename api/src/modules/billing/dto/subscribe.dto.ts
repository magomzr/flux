import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class SubscribeDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['free', 'standard', 'pro'])
  planId!: string;
}
