import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';
import { LavaTopClientService } from './lava-top-client.service';
import { LavaTopWebhookController } from './lava-top-webhook.controller';
import { LavaTopWebhookService } from './lava-top-webhook.service';
import { LavaTopWebhookGuard } from './guards/lava-top-webhook.guard';
import { AdminTokensController } from './admin-tokens.controller';
import { AdminApiGuard } from './guards/admin-api.guard';

@Module({
  imports: [AuthModule, AnalyticsModule],
  controllers: [
    PaymentsController,
    TokensController,
    LavaTopWebhookController,
    AdminTokensController,
  ],
  providers: [
    PaymentsService,
    TokensService,
    LavaTopClientService,
    LavaTopWebhookService,
    LavaTopWebhookGuard,
    AdminApiGuard,
  ],
  exports: [PaymentsService, TokensService],
})
export class PaymentsModule {}
