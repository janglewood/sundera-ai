import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReferenceImagesService } from './reference-images.service';
import { CreateReferenceImageFromUrlDto } from './dto/create-reference-image-from-url.dto';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

@Controller('reference-images')
export class ReferenceImagesController {
  constructor(private readonly referenceImagesService: ReferenceImagesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_UPLOAD_BYTES })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    return this.referenceImagesService.saveUpload(file);
  }

  @Post('from-url')
  async fromUrl(@Body() dto: CreateReferenceImageFromUrlDto) {
    return this.referenceImagesService.saveFromUrl(dto.url);
  }
}
