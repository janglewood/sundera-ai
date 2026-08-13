import { Module } from '@nestjs/common';
import { IMAGE_GENERATION_PROVIDER } from './image-generation.interface';
import { OpenRouterImageGenerationProvider } from './openrouter-image-generation.provider';

@Module({
  providers: [
    {
      provide: IMAGE_GENERATION_PROVIDER,
      useClass: OpenRouterImageGenerationProvider,
    },
  ],
  exports: [IMAGE_GENERATION_PROVIDER],
})
export class ImageGenerationModule {}
