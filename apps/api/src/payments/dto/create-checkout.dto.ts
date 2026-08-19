import { IsIn } from 'class-validator';
import { BILLING_PERIODICITIES, PAID_PLAN_TIERS } from '@sundera/shared';

export class CreateCheckoutDto {
  @IsIn(PAID_PLAN_TIERS)
  planTier!: (typeof PAID_PLAN_TIERS)[number];

  @IsIn(BILLING_PERIODICITIES)
  periodicity!: (typeof BILLING_PERIODICITIES)[number];
}
