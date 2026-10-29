import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { PaidPlanTier, PurchaseResponse } from '@sundera/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { Purchase, TokenGrant, User } from '../../generated/prisma';
import { LavaTopClientService } from './lava-top-client.service';
import type { LavaTopCurrency } from './types/lava-top-api.types';

const OFFER_ID_ENV_VAR: Record<PaidPlanTier, string> = {
  ROOM: 'LAVA_TOP_OFFER_ID_ROOM',
  ROOMS: 'LAVA_TOP_OFFER_ID_ROOMS',
  HOUSE: 'LAVA_TOP_OFFER_ID_HOUSE',
};

@Injectable()
export class PaymentsService {
  private readonly currency: LavaTopCurrency;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lavaTopClient: LavaTopClientService,
    private readonly configService: ConfigService,
  ) {
    this.currency = (this.configService.get<string>('LAVA_TOP_CURRENCY') ??
      'USD') as LavaTopCurrency;
  }

  // Read lazily (not at construction) so the API still boots before every
  // pack's offer is configured on the lava.top dashboard — checkout for that
  // specific pack fails with a clear error until its env var is set.
  private getOfferId(planTier: PaidPlanTier): string {
    const envVar = OFFER_ID_ENV_VAR[planTier];
    const offerId = this.configService.get<string>(envVar);
    if (!offerId) {
      throw new ServiceUnavailableException(
        `The ${planTier} pack isn't set up for checkout yet (missing ${envVar}).`,
      );
    }
    return offerId;
  }

  async createCheckout(
    user: User,
    planTier: PaidPlanTier,
  ): Promise<{ paymentUrl: string }> {
    if (!user.email) {
      throw new BadRequestException(
        'Your account has no email on file — add one before purchasing.',
      );
    }

    const offerId = this.getOfferId(planTier);
    const invoice = await this.lavaTopClient.createInvoice({
      email: user.email,
      offerId,
      currency: this.currency,
      periodicity: 'ONE_TIME',
    });

    if (!invoice.paymentUrl) {
      throw new BadGatewayException(
        'The payment provider did not return a checkout link.',
      );
    }

    // One row per checkout attempt — packs stack, so a user can have several
    // COMPLETED purchases over time (unlike the old single-slot LIFETIME row).
    await this.prisma.purchase.create({
      data: {
        userId: user.id,
        planTier,
        lavaOfferId: offerId,
        lavaContractId: invoice.id,
        status: 'PENDING',
      },
    });

    return { paymentUrl: invoice.paymentUrl };
  }

  // Admin-only manual grant (see AdminPurchasesController) — creates an
  // already-COMPLETED purchase so TokensService picks it up immediately,
  // with a synthetic contract id since there's no real lava.top payment
  // behind it. Used for comps/support cases instead of hand-written SQL.
  async grantPack(userId: string, planTier: PaidPlanTier): Promise<Purchase> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`No user with id ${userId}`);
    }

    return this.prisma.purchase.create({
      data: {
        userId,
        planTier,
        lavaOfferId: 'admin-grant',
        lavaContractId: `admin-grant-${randomUUID()}`,
        status: 'COMPLETED',
        purchasedAt: new Date(),
      },
    });
  }

  // Admin-only arbitrary top-up (see AdminTokensController) — adds `amount`
  // tokens without creating a Purchase, so it doesn't unlock paid styles or
  // drop the watermark the way grantPack's full-pack grant does.
  async grantBonusTokens(
    userId: string,
    amount: number,
    reason?: string,
  ): Promise<TokenGrant> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`No user with id ${userId}`);
    }

    return this.prisma.tokenGrant.create({
      data: { userId, amount, reason },
    });
  }

  // Most recent purchase attempt, used by the frontend to show a "payment
  // processing" state while polling for the webhook after returning from
  // checkout. Token balance/entitlements come from TokensService, not here.
  async getMyPurchase(userId: string): Promise<PurchaseResponse> {
    const purchase = await this.prisma.purchase.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!purchase) {
      return { planTier: 'FREE', status: null, purchasedAt: null };
    }

    return {
      planTier: purchase.planTier,
      status: purchase.status,
      purchasedAt: purchase.purchasedAt?.toISOString() ?? null,
    };
  }
}
