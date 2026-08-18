import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalFirebaseAuthGuard } from '../auth/guards/optional-firebase-auth.guard';
import type { User } from '../../generated/prisma';
import { UploadsService } from './uploads.service';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseGuards(OptionalFirebaseAuthGuard)
  @UseInterceptors(FileInterceptor('photo'))
  async upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_UPLOAD_BYTES })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
    @CurrentUser() user?: User,
  ) {
    return this.uploadsService.saveUpload(file, user?.id);
  }
}
