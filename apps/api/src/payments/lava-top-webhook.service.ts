import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { LavaTopWebhookPayload } from './types/lava-top-api.types';
import { addBillingPeriod } from './billing-period.util';

@Injectable()
export class LavaTopWebhookService {
  private readonly logger = new Logger(LavaTopWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(payload: LavaTopWebhookPayload): Promise<void> {
    // Renewals reference the original purchase via parentContractId; the
    // very first payment IS the parent contract, so it has none.
    const lavaContractId = payload.parentContractId ?? payload.contractId;

    const subscription = await this.prisma.subscription.findUnique({
      where: { lavaContractId },
    });
    if (!subscription) {
      this.logger.warn(
        `Webhook for unknown lava.top contract ${lavaContractId} (event ${payload.eventType})`,
      );
      return;
    }

    switch (payload.eventType) {
      case 'payment.success':
      case 'subscription.recurring.payment.success': {
        // Each successful payment (initial or renewal) opens a fresh usage
        // window — this is what generation/edit counts reset against, see
        // GenerationsService.create().
        const periodStart = new Date(payload.timestamp);
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'ACTIVE',
            currentPeriodStart: periodStart,
            currentPeriodEnd: addBillingPeriod(
              periodStart,
              subscription.periodicity,
            ),
          },
        });
        return;
      }

      case 'payment.failed':
      case 'subscription.recurring.payment.failed':
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'FAILED' },
        });
        return;

      case 'subscription.cancelled':
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(payload.timestamp),
          },
        });
        return;

      default:
        this.logger.warn(
          `Unhandled lava.top webhook event type: ${payload.eventType as string}`,
        );
    }
  }
}
