import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { LavaTopClientService } from './lava-top-client.service';
import { LavaTopWebhookController } from './lava-top-webhook.controller';
import { LavaTopWebhookService } from './lava-top-webhook.service';
import { LavaTopWebhookGuard } from './guards/lava-top-webhook.guard';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController, LavaTopWebhookController],
  providers: [
    PaymentsService,
    LavaTopClientService,
    LavaTopWebhookService,
    LavaTopWebhookGuard,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
