import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LavaTopWebhookGuard } from './guards/lava-top-webhook.guard';
import { LavaTopWebhookService } from './lava-top-webhook.service';
import type { LavaTopWebhookPayload } from './types/lava-top-api.types';

@Controller('payments/webhooks')
export class LavaTopWebhookController {
  constructor(private readonly webhookService: LavaTopWebhookService) {}

  @Post('lava-top')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LavaTopWebhookGuard)
  handle(@Body() payload: LavaTopWebhookPayload) {
    return this.webhookService.handle(payload);
  }
}
