import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

// Same shared-secret pattern as LavaTopWebhookGuard/BlogBotGuard — gates
// manual-intervention routes (e.g. granting tokens from Railway's console
// without hand-writing SQL) behind a header instead of Firebase auth, since
// the caller here is a human operator with API access, not a signed-in user.
@Injectable()
export class AdminApiGuard implements CanActivate {
  private readonly logger = new Logger(AdminApiGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('ADMIN_API_SECRET');
    if (!expected) {
      this.logger.error(
        'Rejecting admin request: ADMIN_API_SECRET is not configured.',
      );
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-admin-secret'];
    if (typeof provided !== 'string' || provided.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  }
}
