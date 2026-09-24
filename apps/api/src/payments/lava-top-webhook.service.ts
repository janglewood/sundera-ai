import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { LavaTopWebhookPayload } from './types/lava-top-api.types';

@Injectable()
export class LavaTopWebhookService {
  private readonly logger = new Logger(LavaTopWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(payload: LavaTopWebhookPayload): Promise<void> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { lavaContractId: payload.contractId },
    });
    if (!purchase) {
      this.logger.warn(
        `Webhook for unknown lava.top contract ${payload.contractId} (event ${payload.eventType})`,
      );
      return;
    }

    switch (payload.eventType) {
      case 'payment.success':
        await this.prisma.purchase.update({
          where: { id: purchase.id },
          data: {
            status: 'COMPLETED',
            purchasedAt: new Date(payload.timestamp),
          },
        });
        return;

      case 'payment.failed':
        await this.prisma.purchase.update({
          where: { id: purchase.id },
          data: { status: 'FAILED' },
        });
        return;

      default:
        this.logger.warn(
          `Unhandled lava.top webhook event type: ${payload.eventType as string}`,
        );
    }
  }
}
