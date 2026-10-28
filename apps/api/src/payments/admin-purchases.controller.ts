import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminApiGuard } from './guards/admin-api.guard';
import { GrantTokensDto } from './dto/grant-tokens.dto';
import { PaymentsService } from './payments.service';
import { TokensService } from './tokens.service';

// Manual token grants (comps, support cases) without hand-writing SQL
// against Purchase in Railway's console. Gated by AdminApiGuard, not
// FirebaseAuthGuard — the caller is an operator with the admin secret, not
// a signed-in user acting on their own account.
@Controller('admin/purchases')
@UseGuards(AdminApiGuard)
export class AdminPurchasesController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly tokensService: TokensService,
  ) {}

  @Post('grant-tokens')
  async grantTokens(@Body() dto: GrantTokensDto) {
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
}
