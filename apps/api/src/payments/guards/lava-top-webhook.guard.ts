import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

// lava.top has no HMAC request-signing — the Integration tab's
// "API-Key" webhook auth option just replays a static shared secret in the
// X-Api-Key header on every delivery. Configure the same value there and in
// LAVA_TOP_WEBHOOK_SECRET.
@Injectable()
export class LavaTopWebhookGuard implements CanActivate {
  private readonly logger = new Logger(LavaTopWebhookGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>(
      'LAVA_TOP_WEBHOOK_SECRET',
    );
    if (!expected) {
      this.logger.error(
        'Rejecting lava.top webhook: LAVA_TOP_WEBHOOK_SECRET is not configured.',
      );
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-api-key'];
    if (typeof provided !== 'string' || provided.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  }
}
