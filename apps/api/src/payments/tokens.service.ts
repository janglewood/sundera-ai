import { Injectable } from '@nestjs/common';
import {
  resolveEntitlements,
  type Entitlements,
  type PaidPlanTier,
} from '@sundera/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma';

type QueryClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class TokensService {
  constructor(private readonly prisma: PrismaService) {}

  // Pure DB read, no side effects — safe to call with either the top-level
  // PrismaService or a $transaction client (see GenerationsService, which
  // re-checks this inside a per-user advisory lock to prevent double-spend).
  async getEntitlements(
    userId: string,
    client: QueryClient = this.prisma,
  ): Promise<Entitlements> {
    const [completedPurchases, tokensUsed] = await Promise.all([
      client.purchase.findMany({
        where: { userId, status: 'COMPLETED' },
        select: { planTier: true },
      }),
      // Generations AND edits both consume a token (edits are Generation
      // rows with sourceResultId set) — FAILED rows are excluded so a
      // failed generation auto-refunds its token.
      client.generation.count({
        where: { userId, status: { not: 'FAILED' } },
      }),
    ]);

    const completedTiers = completedPurchases.map(
      (purchase) => purchase.planTier,
    ) as PaidPlanTier[];
    return resolveEntitlements(completedTiers, tokensUsed);
  }
}
