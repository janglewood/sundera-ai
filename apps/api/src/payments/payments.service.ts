import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  BillingPeriodicity,
  PaidPlanTier,
  PlanTier,
  SubscriptionResponse,
} from '@sundera/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { Subscription, User } from '../../generated/prisma';
import { LavaTopClientService } from './lava-top-client.service';
import type {
  LavaTopCurrency,
  LavaTopPeriodicity,
} from './types/lava-top-api.types';

const PERIODICITY_MAP: Record<BillingPeriodicity, LavaTopPeriodicity> = {
  MONTHLY: 'MONTHLY',
  PERIOD_YEAR: 'PERIOD_YEAR',
};

@Injectable()
export class PaymentsService {
  // Read lazily so the API still boots before every paid tier has an offer
  // configured on the lava.top dashboard — checkout for a specific tier
  // fails with a clear error until its offer id is set.
  private readonly offerIds: Partial<Record<PaidPlanTier, string>>;
  private readonly currency: LavaTopCurrency;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lavaTopClient: LavaTopClientService,
    private readonly configService: ConfigService,
  ) {
    this.offerIds = {
      STARTER: this.configService.get<string>('LAVA_TOP_OFFER_ID_STARTER'),
      PRO: this.configService.get<string>('LAVA_TOP_OFFER_ID_PRO'),
    };
    this.currency = (this.configService.get<string>('LAVA_TOP_CURRENCY') ??
      'USD') as LavaTopCurrency;
  }

  async createCheckout(
    user: User,
    planTier: PaidPlanTier,
    periodicity: BillingPeriodicity,
  ): Promise<{ paymentUrl: string }> {
    if (!user.email) {
      throw new BadRequestException(
        'Your account has no email on file — add one before subscribing.',
      );
    }

    const offerId = this.offerIds[planTier];
    if (!offerId) {
      throw new ServiceUnavailableException(
        `The ${planTier} plan isn't set up for checkout yet (missing LAVA_TOP_OFFER_ID_${planTier}).`,
      );
    }
    const invoice = await this.lavaTopClient.createInvoice({
      email: user.email,
      offerId,
      currency: this.currency,
      periodicity: PERIODICITY_MAP[periodicity],
    });

    if (!invoice.paymentUrl) {
      throw new BadGatewayException(
        'The payment provider did not return a checkout link for this plan.',
      );
    }

    // upsert: re-checking out (e.g. retrying a failed payment, or switching
    // tiers before ever completing one) replaces the pending row for this
    // user rather than growing a history — there's one subscription slot
    // per user for now, matching the product having no plan-switching UI yet.
    await this.prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        planTier,
        periodicity,
        lavaOfferId: offerId,
        lavaContractId: invoice.id,
        status: 'PENDING',
      },
      update: {
        planTier,
        periodicity,
        lavaOfferId: offerId,
        lavaContractId: invoice.id,
        status: 'PENDING',
        cancelledAt: null,
      },
    });

    return { paymentUrl: invoice.paymentUrl };
  }

  async getMySubscription(userId: string): Promise<SubscriptionResponse> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!subscription) {
      return {
        planTier: 'FREE',
        status: null,
        periodicity: null,
        currentPeriodEnd: null,
        cancelledAt: null,
      };
    }

    return {
      planTier: subscription.planTier,
      status: subscription.status,
      periodicity: subscription.periodicity as BillingPeriodicity,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
    };
  }

  async cancelMySubscription(user: User): Promise<SubscriptionResponse> {
    if (!user.email) {
      throw new BadRequestException('Your account has no email on file.');
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId: user.id },
    });
    if (!subscription || subscription.status === 'CANCELLED') {
      throw new NotFoundException('No active subscription to cancel.');
    }

    await this.lavaTopClient.cancelSubscription(
      subscription.lavaContractId,
      user.email,
    );

    const updated = await this.prisma.subscription.update({
      where: { userId: user.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    return {
      planTier: updated.planTier,
      status: updated.status,
      periodicity: updated.periodicity as BillingPeriodicity,
      currentPeriodEnd: updated.currentPeriodEnd?.toISOString() ?? null,
      cancelledAt: updated.cancelledAt?.toISOString() ?? null,
    };
  }

  // A cancelled subscription was already paid for through currentPeriodEnd —
  // lava.top stops future renewals but doesn't refund the current period, so
  // the user keeps their plan tier until that date passes. PENDING checkouts,
  // FAILED payments, and EXPIRED subs (or a CANCELLED one past its period
  // end) grant nothing.
  private isEntitled(subscription: Subscription): boolean {
    if (subscription.status === 'ACTIVE') return true;
    if (subscription.status === 'CANCELLED') {
      return (
        subscription.currentPeriodEnd !== null &&
        subscription.currentPeriodEnd.getTime() > Date.now()
      );
    }
    return false;
  }

  // Anonymous requests and users who never subscribed are FREE.
  async resolvePlanTier(userId?: string): Promise<PlanTier> {
    if (!userId) return 'FREE';
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!subscription || !this.isEntitled(subscription)) return 'FREE';
    return subscription.planTier;
  }

  // Start of the paid plan's current billing window, used to reset
  // generation counts monthly/annually instead of counting lifetime usage.
  // Null for FREE users and for entitled subscriptions whose first payment
  // webhook hasn't landed yet — callers should fall back to a lifetime count
  // in that case rather than letting usage through unchecked.
  async getCurrentPeriodStart(userId?: string): Promise<Date | null> {
    if (!userId) return null;
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!subscription || !this.isEntitled(subscription)) return null;
    return subscription.currentPeriodStart;
  }
}
