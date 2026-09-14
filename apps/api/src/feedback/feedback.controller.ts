import { Body, Controller, Post } from '@nestjs/common';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async create(@Body() dto: CreateFeedbackDto): Promise<{ ok: true }> {
    await this.feedbackService.send(dto.email, dto.message);
    return { ok: true };
  }
}
