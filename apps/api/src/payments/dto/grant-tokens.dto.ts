import { IsIn, IsString, MinLength } from 'class-validator';
import { PAID_PLAN_TIERS, type PaidPlanTier } from '@sundera/shared';

export class GrantTokensDto {
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsIn(PAID_PLAN_TIERS)
  planTier!: PaidPlanTier;
}
