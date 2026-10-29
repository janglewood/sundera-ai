import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class GrantBonusTokensDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
