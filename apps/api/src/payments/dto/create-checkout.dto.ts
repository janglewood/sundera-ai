import { IsIn } from 'class-validator';
import { PAID_PLAN_TIERS, type PaidPlanTier } from '@sundera/shared';

export class CreateCheckoutDto {
  @IsIn(PAID_PLAN_TIERS)
  planTier!: PaidPlanTier;
}
