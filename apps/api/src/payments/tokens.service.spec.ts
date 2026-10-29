import { resolveEntitlements, type PaidPlanTier } from '@sundera/shared';
import { TokensService } from './tokens.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('resolveEntitlements', () => {
  it('grants the free tokens with nothing used', () => {
    expect(resolveEntitlements([], 0).tokensBalance).toBe(2);
  });

  it('adds a ROOM pack on top of the free tokens', () => {
    expect(resolveEntitlements(['ROOM'], 0).tokensBalance).toBe(12);
  });

  it('subtracts tokens already used', () => {
    expect(resolveEntitlements(['ROOM'], 1).tokensBalance).toBe(11);
  });

  it('stacks multiple completed packs', () => {
    expect(resolveEntitlements(['ROOM', 'HOUSE'], 0).tokensBalance).toBe(62);
  });

  it('reports the highest-priced owned tier as planTier', () => {
    expect(resolveEntitlements(['ROOM', 'HOUSE'], 0).planTier).toBe('HOUSE');
    expect(resolveEntitlements([], 0).planTier).toBe('FREE');
  });

  it('adds bonus tokens without affecting planTier', () => {
    const entitlements = resolveEntitlements([], 0, 5);
    expect(entitlements.tokensBalance).toBe(7);
    expect(entitlements.planTier).toBe('FREE');
    expect(entitlements.watermarkOnDownload).toBe(true);
  });
});

describe('TokensService.getEntitlements', () => {
  function fakePrisma(completedTiers: PaidPlanTier[], tokensUsed: number) {
    const findMany = jest
      .fn()
      .mockResolvedValue(completedTiers.map((planTier) => ({ planTier })));
    const count = jest.fn().mockResolvedValue(tokensUsed);
    const aggregate = jest.fn().mockResolvedValue({ _sum: { amount: null } });
    const prisma = {
      purchase: { findMany },
      generation: { count },
      tokenGrant: { aggregate },
    } as unknown as PrismaService;
    return { prisma, findMany, count, aggregate };
  }

  it('excludes FAILED generations from tokensUsed', async () => {
    const { prisma, findMany, count } = fakePrisma(['ROOM'], 3);
    const service = new TokensService(prisma);

    const entitlements = await service.getEntitlements('user-1', prisma);

    expect(count).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: { not: 'FAILED' } },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'COMPLETED' },
      select: { planTier: true },
    });
    expect(entitlements.tokensBalance).toBe(9);
  });
});
