import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';

@Injectable()
export class PosthogService implements OnModuleDestroy {
  private readonly logger = new Logger(PosthogService.name);
  private readonly client: PostHog | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('POSTHOG_KEY');
    if (!apiKey) {
      this.client = null;
      return;
    }
    this.client = new PostHog(apiKey, {
      host:
        this.configService.get<string>('POSTHOG_HOST') ??
        'https://us.i.posthog.com',
    });
  }

  // distinctId must be the Firebase uid, matching posthog.identify(uid) on
  // the client (see apps/web/src/lib/auth/auth-context.tsx) — otherwise this
  // event lands on a separate, never-identified PostHog person.
  capture(
    distinctId: string,
    event: string,
    properties?: Record<string, unknown>,
  ): void {
    if (!this.client) return;
    this.client.capture({ distinctId, event, properties });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.shutdown();
    } catch (err) {
      this.logger.warn(`PostHog shutdown failed: ${(err as Error).message}`);
    }
  }
}
