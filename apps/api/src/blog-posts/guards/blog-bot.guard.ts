import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

// Same shared-secret pattern as LavaTopWebhookGuard — marketing/blog/'s bot
// (Railway) sends this on every write/bot-only read so it's the only thing
// that can create BlogPost rows or see unpublished source-key state. Also
// used by blog-admin's server-side routes in apps/web (BlogPostsAdminController)
// — same trust boundary (a privileged caller that can read/edit/publish
// unpublished posts), reusing the secret rather than adding a parallel one.
@Injectable()
export class BlogBotGuard implements CanActivate {
  private readonly logger = new Logger(BlogBotGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('BLOG_BOT_API_SECRET');
    if (!expected) {
      this.logger.error(
        'Rejecting blog-bot request: BLOG_BOT_API_SECRET is not configured.',
      );
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-blog-bot-secret'];
    if (typeof provided !== 'string' || provided.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  }
}
