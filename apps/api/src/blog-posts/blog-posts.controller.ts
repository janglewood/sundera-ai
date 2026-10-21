import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BlogBotGuard } from './guards/blog-bot.guard';
import { BlogPostsService } from './blog-posts.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';

@Controller('blog-posts')
export class BlogPostsController {
  constructor(private readonly blogPostsService: BlogPostsService) {}

  @Get()
  findPublished(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.blogPostsService.findPublished(
      offset !== undefined ? Number(offset) : undefined,
      limit !== undefined ? Number(limit) : undefined,
    );
  }

  @Get('source-keys')
  @UseGuards(BlogBotGuard)
  listUsedSourceKeys() {
    return this.blogPostsService.listUsedSourceKeys();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.blogPostsService.findBySlug(slug);
  }

  @Post()
  @UseGuards(BlogBotGuard)
  create(@Body() dto: CreateBlogPostDto) {
    return this.blogPostsService.create(dto);
  }
}
