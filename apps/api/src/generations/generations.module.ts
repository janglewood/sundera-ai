import { Module } from '@nestjs/common';
import { ImageGenerationModule } from '../image-generation/image-generation.module';
import { GenerationsController } from './generations.controller';
import { GenerationsService } from './generations.service';
import { GenerationWorkerService } from './generation-worker.service';

@Module({
  imports: [ImageGenerationModule],
  controllers: [GenerationsController],
  providers: [GenerationsService, GenerationWorkerService],
})
export class GenerationsModule {}
