import { BadRequestException, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async saveUpload(file: Express.Multer.File, userId?: string) {
    const ext = ALLOWED_MIME_TYPES[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Use JPEG, PNG, or WebP.`,
      );
    }

    const id = uuid();
    const storageKey = this.storage.buildObjectKey('uploads', id, ext);
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    const roomPhoto = await this.prisma.roomPhoto.create({
      data: { id, storageKey, mimeType: file.mimetype, userId },
    });

    const previewUrl = await this.storage.getPresignedGetUrl(storageKey);
    return { id: roomPhoto.id, previewUrl };
  }
}
