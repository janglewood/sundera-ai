import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ReferenceImagesController } from './reference-images.controller';
import { ReferenceImagesService } from './reference-images.service';

@Module({
  imports: [MulterModule.register({ storage: memoryStorage() })],
  controllers: [ReferenceImagesController],
  providers: [ReferenceImagesService],
})
export class ReferenceImagesModule {}
