import { BadRequestException, Injectable } from '@nestjs/common';
import heicConvert from 'heic-convert';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'jpg',
  'image/heif': 'jpg',
};

// Gemini/OpenRouter's vision input and browser <img> previews don't support
// HEIC, so anything decoded as HEIC/HEIF is transcoded to JPEG before storage.
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif']);

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
        `Unsupported file type: ${file.mimetype}. Use JPEG, PNG, WebP, or HEIC.`,
      );
    }

    let buffer = file.buffer;
    let mimeType = file.mimetype;
    if (HEIC_MIME_TYPES.has(file.mimetype)) {
      try {
        buffer = await heicConvert({
          buffer: file.buffer,
          format: 'JPEG',
          quality: 0.92,
        });
      } catch {
        throw new BadRequestException('Could not read this HEIC file.');
      }
      mimeType = 'image/jpeg';
    }

    const id = uuid();
    const storageKey = this.storage.buildObjectKey('uploads', id, ext);
    await this.storage.putObject(storageKey, buffer, mimeType);

    const roomPhoto = await this.prisma.roomPhoto.create({
      data: { id, storageKey, mimeType, userId },
    });

    const previewUrl = await this.storage.getPresignedGetUrl(storageKey);
    return { id: roomPhoto.id, previewUrl };
  }
}
