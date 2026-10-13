import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// Flips due SCHEDULED posts to PUBLISHED. No per-row claim (unlike
// GenerationWorkerService) — there's no external work to do here, just a
// status flip, so a single bulk UPDATE is safe even with multiple instances.
@Injectable()
export class BlogPostsPublishWorkerService {
  private readonly logger = new Logger(BlogPostsPublishWorkerService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('*/30 * * * * *')
  async tick() {
    const published = await this.prisma.$queryRaw<{ id: string; slug: string }[]>`
      UPDATE "BlogPost"
      SET status = 'PUBLISHED', "publishedAt" = now()
      WHERE status = 'SCHEDULED' AND "scheduledFor" <= now()
      RETURNING id, slug
    `;
    for (const post of published) {
      this.logger.log(`Published blog post ${post.slug} (${post.id})`);
    }
  }
}
