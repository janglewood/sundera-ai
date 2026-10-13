import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  BlogPostAdminDetail,
  BlogPostDetail,
  BlogPostQueueItem,
  BlogPostSummary,
} from '@sundera/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import type { BlogPost, Prisma } from '../../generated/prisma';

function parseHourMinute(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map(Number);
  return { hour, minute };
}

function toSummary(post: BlogPost): BlogPostSummary {
  return {
    slug: post.slug,
    title: post.title,
    dek: post.dek,
    roomType: post.roomType as BlogPostSummary['roomType'],
    style: post.style as BlogPostSummary['style'],
    imageUrl: post.imageUrl,
    imageAlt: post.imageAlt,
    publishedAt: (post.publishedAt ?? post.createdAt).toISOString(),
  };
}

function toDetail(post: BlogPost): BlogPostDetail {
  return {
    ...toSummary(post),
    problems: post.problems as unknown as string[],
    palette: post.palette,
    materials: post.materials,
    lighting: post.lighting,
    priceTable: post.priceTable as unknown as BlogPostDetail['priceTable'],
    faq: post.faq as unknown as BlogPostDetail['faq'],
  };
}

function toQueueItem(post: BlogPost): BlogPostQueueItem {
  return {
    slug: post.slug,
    title: post.title,
    dek: post.dek,
    roomType: post.roomType as BlogPostQueueItem['roomType'],
    style: post.style as BlogPostQueueItem['style'],
    imageUrl: post.imageUrl,
    imageAlt: post.imageAlt,
    scheduledFor: post.scheduledFor.toISOString(),
  };
}

function toAdminDetail(post: BlogPost): BlogPostAdminDetail {
  return {
    slug: post.slug,
    title: post.title,
    dek: post.dek,
    roomType: post.roomType as BlogPostAdminDetail['roomType'],
    style: post.style as BlogPostAdminDetail['style'],
    imageUrl: post.imageUrl,
    imageAlt: post.imageAlt,
    problems: post.problems as unknown as string[],
    palette: post.palette,
    materials: post.materials,
    lighting: post.lighting,
    priceTable: post.priceTable as unknown as BlogPostAdminDetail['priceTable'],
    faq: post.faq as unknown as BlogPostAdminDetail['faq'],
    status: post.status,
    scheduledFor: post.scheduledFor.toISOString(),
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
  };
}

@Injectable()
export class BlogPostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async findPublished(): Promise<BlogPostSummary[]> {
    const posts = await this.prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
    });
    return posts.map(toSummary);
  }

  async findBySlug(slug: string): Promise<BlogPostDetail> {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post || post.status !== 'PUBLISHED') {
      throw new NotFoundException(`No published blog post with slug ${slug}`);
    }
    return toDetail(post);
  }

  // blog-admin (apps/web) — posts still waiting for their scheduled slot,
  // i.e. not live on the site yet. Oldest slot first, matching the order
  // they'll actually go out.
  async findQueue(): Promise<BlogPostQueueItem[]> {
    const posts = await this.prisma.blogPost.findMany({
      where: { status: 'SCHEDULED' },
      orderBy: { scheduledFor: 'asc' },
    });
    return posts.map(toQueueItem);
  }

  // Unlike findBySlug, not restricted to PUBLISHED — blog-admin needs to load
  // a still-queued post to preview/edit it.
  async findForAdmin(slug: string): Promise<BlogPostAdminDetail> {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post) {
      throw new NotFoundException(`No blog post with slug ${slug}`);
    }
    return toAdminDetail(post);
  }

  // Editing is scoped to queued posts only — once a post is PUBLISHED it's
  // live on the site and out of blog-admin's "queue, edit, publish" flow.
  async update(slug: string, dto: UpdateBlogPostDto): Promise<BlogPostAdminDetail> {
    const post = await this.requireScheduled(slug);
    const updated = await this.prisma.blogPost.update({
      where: { slug: post.slug },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.dek !== undefined && { dek: dto.dek }),
        ...(dto.imageAlt !== undefined && { imageAlt: dto.imageAlt }),
        ...(dto.problems !== undefined && {
          problems: dto.problems as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.palette !== undefined && { palette: dto.palette }),
        ...(dto.materials !== undefined && { materials: dto.materials }),
        ...(dto.lighting !== undefined && { lighting: dto.lighting }),
        ...(dto.priceTable !== undefined && {
          priceTable: dto.priceTable as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.faq !== undefined && { faq: dto.faq as unknown as Prisma.InputJsonValue }),
      },
    });
    return toAdminDetail(updated);
  }

  // Publishing from blog-admin jumps the queue: live immediately rather than
  // waiting for the randomized scheduledFor slot. That's the whole point of
  // a manual "Publish" action, and it's also what takes the post out of the
  // queue (findQueue only returns SCHEDULED posts).
  async publishNow(slug: string): Promise<BlogPostAdminDetail> {
    await this.requireScheduled(slug);
    const updated = await this.prisma.blogPost.update({
      where: { slug },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    return toAdminDetail(updated);
  }

  private async requireScheduled(slug: string): Promise<BlogPost> {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post) {
      throw new NotFoundException(`No blog post with slug ${slug}`);
    }
    if (post.status !== 'SCHEDULED') {
      throw new ConflictException(`Blog post ${slug} is already published`);
    }
    return post;
  }

  async listUsedSourceKeys(): Promise<string[]> {
    const posts = await this.prisma.blogPost.findMany({
      select: { sourceImageKey: true },
    });
    return posts.map((post) => post.sourceImageKey);
  }

  async create(dto: CreateBlogPostDto): Promise<{ slug: string; scheduledFor: string }> {
    const existing = await this.prisma.blogPost.findUnique({
      where: { sourceImageKey: dto.sourceImageKey },
    });
    if (existing) {
      throw new ConflictException(
        `A blog post already exists for sourceImageKey ${dto.sourceImageKey}`,
      );
    }

    const scheduledFor = await this.pickNextSlot();
    const post = await this.prisma.blogPost.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        dek: dto.dek,
        roomType: dto.roomType,
        style: dto.style,
        imageUrl: dto.imageUrl,
        imageAlt: dto.imageAlt,
        problems: dto.problems as unknown as Prisma.InputJsonValue,
        palette: dto.palette,
        materials: dto.materials,
        lighting: dto.lighting,
        priceTable: dto.priceTable as unknown as Prisma.InputJsonValue,
        faq: dto.faq as unknown as Prisma.InputJsonValue,
        sourceImageKey: dto.sourceImageKey,
        scheduledFor,
      },
    });
    return { slug: post.slug, scheduledFor: post.scheduledFor.toISOString() };
  }

  /**
   * Spreads posts over BLOG_PUBLISH_WINDOW_START..END (UTC), up to
   * BLOG_POSTS_PER_DAY per day, rolling into tomorrow's window once today's
   * slots are full. Mirrors the Pinterest bot's pick_publish_times, including
   * its max(now, windowStart) clamp so a backlog of approvals doesn't all
   * fire in the same tick once the window has already started.
   */
  private async pickNextSlot(): Promise<Date> {
    const perDay = Number(this.configService.get('BLOG_POSTS_PER_DAY') ?? 3);
    const windowStart = parseHourMinute(
      this.configService.get<string>('BLOG_PUBLISH_WINDOW_START') ?? '09:00',
    );
    const windowEnd = parseHourMinute(
      this.configService.get<string>('BLOG_PUBLISH_WINDOW_END') ?? '21:00',
    );

    const now = new Date();
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
      const candidateDay = new Date(dayStart.getTime() + dayOffset * 86_400_000);
      const rangeStart = new Date(candidateDay);
      rangeStart.setUTCHours(windowStart.hour, windowStart.minute, 0, 0);
      const rangeEnd = new Date(candidateDay);
      rangeEnd.setUTCHours(windowEnd.hour, windowEnd.minute, 0, 0);

      const effectiveStart = dayOffset === 0 && rangeStart < now ? now : rangeStart;
      if (effectiveStart >= rangeEnd) {
        continue; // today's window is already over — try tomorrow
      }

      const usedToday = await this.prisma.blogPost.count({
        where: { scheduledFor: { gte: rangeStart, lt: rangeEnd } },
      });
      if (usedToday >= perDay) {
        continue; // today's slots are full — try tomorrow
      }

      const spanMs = rangeEnd.getTime() - effectiveStart.getTime();
      return new Date(effectiveStart.getTime() + Math.random() * spanMs);
    }

    throw new Error('Could not find an available publish slot in the next year');
  }
}
