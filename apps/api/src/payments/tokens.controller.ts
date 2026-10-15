import { Controller, Get, UseGuards } from '@nestjs/common';
import type { TokensResponse } from '@sundera/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { User } from '../../generated/prisma';
import { TokensService } from './tokens.service';

@Controller('tokens')
@UseGuards(FirebaseAuthGuard)
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  async getMyTokens(@CurrentUser() user: User): Promise<TokensResponse> {
    const entitlements = await this.tokensService.getEntitlements(user.id);
    return {
      balance: entitlements.tokensBalance,
      granted: entitlements.tokensGranted,
      used: entitlements.tokensUsed,
      planTier: entitlements.planTier,
    };
  }
}
