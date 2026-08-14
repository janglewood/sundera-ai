import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateGenerationDto } from './dto/create-generation.dto';

@Injectable()
export class GenerationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateGenerationDto) {
    const roomPhoto = await this.prisma.roomPhoto.findUnique({
      where: { id: dto.roomPhotoId },
    });
    if (!roomPhoto) {
      throw new NotFoundException(
        `RoomPhoto not found: ${dto.roomPhotoId}`,
      );
    }

    const generation = await this.prisma.generation.create({
      data: {
        roomPhotoId: dto.roomPhotoId,
        roomType: dto.roomType,
        style: dto.style,
        customPrompt: dto.customPrompt,
        model: this.configService.getOrThrow<string>('OPENROUTER_MODEL'),
      },
    });

    return { id: generation.id, status: generation.status };
  }

  async getById(id: string) {
    const generation = await this.prisma.generation.findUnique({
      where: { id },
      include: { roomPhoto: true, results: { orderBy: { index: 'asc' } } },
    });
    if (!generation) {
      throw new NotFoundException(`Generation not found: ${id}`);
    }

    const sourceImageUrl = await this.storage.getPresignedGetUrl(
      generation.roomPhoto.storageKey,
    );

    const resultImages =
      generation.status === 'COMPLETED'
        ? await Promise.all(
            generation.results.map(async (result) => ({
              index: result.index,
              url: await this.storage.getPresignedGetUrl(result.storageKey),
            })),
          )
        : null;

    return {
      id: generation.id,
      status: generation.status,
      roomType: generation.roomType,
      style: generation.style,
      customPrompt: generation.customPrompt,
      sourceImageUrl,
      resultImages,
      errorMessage: generation.errorMessage,
      createdAt: generation.createdAt.toISOString(),
      completedAt: generation.completedAt?.toISOString() ?? null,
    };
  }
}
