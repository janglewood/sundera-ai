import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';
import { LavaTopClientService } from './lava-top-client.service';
import { LavaTopWebhookController } from './lava-top-webhook.controller';
import { LavaTopWebhookService } from './lava-top-webhook.service';
import { LavaTopWebhookGuard } from './guards/lava-top-webhook.guard';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController, TokensController, LavaTopWebhookController],
  providers: [
    PaymentsService,
    TokensService,
    LavaTopClientService,
    LavaTopWebhookService,
    LavaTopWebhookGuard,
  ],
  exports: [PaymentsService, TokensService],
})
export class PaymentsModule {}
