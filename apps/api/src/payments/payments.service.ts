import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PlanTier, PurchaseResponse } from '@sundera/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from '../../generated/prisma';
import { LavaTopClientService } from './lava-top-client.service';
import type { LavaTopCurrency } from './types/lava-top-api.types';

@Injectable()
export class PaymentsService {
  // Read lazily so the API still boots before the lifetime offer is
  // configured on the lava.top dashboard — checkout fails with a clear
  // error until it's set.
  private readonly offerId?: string;
  private readonly currency: LavaTopCurrency;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lavaTopClient: LavaTopClientService,
    private readonly configService: ConfigService,
  ) {
    this.offerId = this.configService.get<string>('LAVA_TOP_OFFER_ID_LIFETIME');
    this.currency = (this.configService.get<string>('LAVA_TOP_CURRENCY') ??
      'USD') as LavaTopCurrency;
  }

  async createCheckout(user: User): Promise<{ paymentUrl: string }> {
    if (!user.email) {
      throw new BadRequestException(
        'Your account has no email on file — add one before purchasing.',
      );
    }

    if (!this.offerId) {
      throw new ServiceUnavailableException(
        "The lifetime plan isn't set up for checkout yet (missing LAVA_TOP_OFFER_ID_LIFETIME).",
      );
    }
    const invoice = await this.lavaTopClient.createInvoice({
      email: user.email,
      offerId: this.offerId,
      currency: this.currency,
      periodicity: 'ONE_TIME',
    });

    if (!invoice.paymentUrl) {
      throw new BadGatewayException(
        'The payment provider did not return a checkout link.',
      );
    }

    // upsert: re-checking out (e.g. retrying a failed payment) replaces the
    // pending row for this user rather than growing a history — there's one
    // purchase slot per user, matching a single lifetime tier.
    await this.prisma.purchase.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        planTier: 'LIFETIME',
        lavaOfferId: this.offerId,
        lavaContractId: invoice.id,
        status: 'PENDING',
      },
      update: {
        lavaOfferId: this.offerId,
        lavaContractId: invoice.id,
        status: 'PENDING',
      },
    });

    return { paymentUrl: invoice.paymentUrl };
  }

  async getMyPurchase(userId: string): Promise<PurchaseResponse> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { userId },
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

  // Anonymous requests and users who never purchased are FREE. A purchase
  // is permanent once COMPLETED — no period or cancellation to check.
  async resolvePlanTier(userId?: string): Promise<PlanTier> {
    if (!userId) return 'FREE';
    const purchase = await this.prisma.purchase.findUnique({
      where: { userId },
    });
    if (!purchase || purchase.status !== 'COMPLETED') return 'FREE';
    return purchase.planTier;
  }
}
