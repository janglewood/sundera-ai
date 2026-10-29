import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminApiGuard } from './guards/admin-api.guard';
import { GrantTokensDto } from './dto/grant-tokens.dto';
import { GrantBonusTokensDto } from './dto/grant-bonus-tokens.dto';
import { PaymentsService } from './payments.service';
import { TokensService } from './tokens.service';

// Manual token grants (comps, support cases) without hand-writing SQL
// against Purchase/TokenGrant in Railway's console. Gated by AdminApiGuard,
// not FirebaseAuthGuard — the caller is an operator with the admin secret,
// not a signed-in user acting on their own account.
@Controller('admin/tokens')
@UseGuards(AdminApiGuard)
export class AdminTokensController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly tokensService: TokensService,
  ) {}

  // Grants a full pack (10/25/50 tokens) as a COMPLETED purchase — also
  // unlocks paid styles and drops the watermark, same as a real checkout.
  @Post('grant-pack')
  async grantPack(@Body() dto: GrantTokensDto) {
    const purchase = await this.paymentsService.grantPack(
      dto.userId,
      dto.planTier,
    );
    const entitlements = await this.tokensService.getEntitlements(dto.userId);

    return {
      purchaseId: purchase.id,
      userId: purchase.userId,
      planTier: purchase.planTier,
      tokensBalance: entitlements.tokensBalance,
      tokensGranted: entitlements.tokensGranted,
    };
  }

  // Grants an arbitrary number of bonus tokens (e.g. 5) without touching
  // plan tier / style unlocks / watermark status.
  @Post('grant-bonus')
  async grantBonus(@Body() dto: GrantBonusTokensDto) {
    const grant = await this.paymentsService.grantBonusTokens(
      dto.userId,
      dto.amount,
      dto.reason,
    );
    const entitlements = await this.tokensService.getEntitlements(dto.userId);

    return {
      grantId: grant.id,
      userId: grant.userId,
      amount: grant.amount,
      tokensBalance: entitlements.tokensBalance,
      tokensGranted: entitlements.tokensGranted,
    };
  }
}
