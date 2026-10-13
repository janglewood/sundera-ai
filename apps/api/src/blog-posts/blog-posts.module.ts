import { Module } from '@nestjs/common';
import { BlogPostsController } from './blog-posts.controller';
import { BlogPostsAdminController } from './blog-posts-admin.controller';
import { BlogPostsService } from './blog-posts.service';
import { BlogPostsPublishWorkerService } from './blog-posts-publish-worker.service';
import { BlogBotGuard } from './guards/blog-bot.guard';

@Module({
  controllers: [BlogPostsController, BlogPostsAdminController],
  providers: [BlogPostsService, BlogPostsPublishWorkerService, BlogBotGuard],
})
export class BlogPostsModule {}
