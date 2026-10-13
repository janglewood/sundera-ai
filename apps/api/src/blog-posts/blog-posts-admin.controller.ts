import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BlogBotGuard } from './guards/blog-bot.guard';
import { BlogPostsService } from './blog-posts.service';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';

// Backs blog-admin (apps/web, server-side only — see its BLOG_BOT_API_SECRET
// usage). Separate from BlogPostsController because every route here is
// gated by the shared-secret guard; the public controller's routes aren't.
@Controller('blog-posts/admin')
@UseGuards(BlogBotGuard)
export class BlogPostsAdminController {
  constructor(private readonly blogPostsService: BlogPostsService) {}

  @Get('queue')
  findQueue() {
    return this.blogPostsService.findQueue();
  }

  @Get(':slug')
  findForAdmin(@Param('slug') slug: string) {
    return this.blogPostsService.findForAdmin(slug);
  }

  @Patch(':slug')
  update(@Param('slug') slug: string, @Body() dto: UpdateBlogPostDto) {
    return this.blogPostsService.update(slug, dto);
  }

  @Post(':slug/publish')
  publish(@Param('slug') slug: string) {
    return this.blogPostsService.publishNow(slug);
  }

  @Delete(':slug')
  @HttpCode(204)
  remove(@Param('slug') slug: string) {
    return this.blogPostsService.deleteQueued(slug);
  }
}
