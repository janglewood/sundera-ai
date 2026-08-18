import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { CreateEditGenerationDto } from './dto/create-edit-generation.dto';

@Injectable()
export class GenerationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateGenerationDto, userId?: string) {
    const roomPhoto = await this.prisma.roomPhoto.findUnique({
      where: { id: dto.roomPhotoId },
    });
    if (!roomPhoto) {
      throw new NotFoundException(`RoomPhoto not found: ${dto.roomPhotoId}`);
    }

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        roomPhotoId: dto.roomPhotoId,
        roomType: dto.roomType,
        style: dto.style,
        customPrompt: dto.customPrompt,
        model: this.configService.getOrThrow<string>('OPENROUTER_MODEL'),
      },
    });

    return { id: generation.id, status: generation.status };
  }

  async createEdit(
    parentGenerationId: string,
    dto: CreateEditGenerationDto,
    userId?: string,
  ) {
    const parent = await this.prisma.generation.findUnique({
      where: { id: parentGenerationId },
      include: { results: true },
    });
    if (!parent) {
      throw new NotFoundException(
        `Generation not found: ${parentGenerationId}`,
      );
    }
    if (parent.status !== 'COMPLETED') {
      throw new BadRequestException(
        `Generation ${parentGenerationId} is not completed yet`,
      );
    }
    const sourceResult = parent.results.find(
      (result) => result.id === dto.sourceResultId,
    );
    if (!sourceResult) {
      throw new NotFoundException(
        `GenerationResult not found: ${dto.sourceResultId}`,
      );
    }

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        roomPhotoId: parent.roomPhotoId,
        roomType: parent.roomType,
        style: parent.style,
        customPrompt: dto.prompt,
        sourceResultId: sourceResult.id,
        model: this.configService.getOrThrow<string>('OPENROUTER_MODEL'),
      },
    });

    return { id: generation.id, status: generation.status };
  }

  async getById(id: string) {
    const generation = await this.prisma.generation.findUnique({
      where: { id },
      include: {
        roomPhoto: true,
        sourceResult: true,
        results: { orderBy: { index: 'asc' } },
      },
    });
    if (!generation) {
      throw new NotFoundException(`Generation not found: ${id}`);
    }

    const sourceImageUrl = await this.storage.getPresignedGetUrl(
      generation.sourceResult?.storageKey ?? generation.roomPhoto.storageKey,
    );

    const resultImages =
      generation.status === 'COMPLETED'
        ? await Promise.all(
            generation.results.map(async (result) => ({
              id: result.id,
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
      isEdit: generation.sourceResultId !== null,
      parentGenerationId: generation.sourceResult?.generationId ?? null,
    };
  }

  async getResultFile(generationId: string, resultId: string) {
    const result = await this.prisma.generationResult.findUnique({
      where: { id: resultId },
    });
    if (!result || result.generationId !== generationId) {
      throw new NotFoundException(`GenerationResult not found: ${resultId}`);
    }

    const { buffer, contentType } = await this.storage.getObject(
      result.storageKey,
    );
    const ext = result.storageKey.split('.').pop() ?? 'jpg';
    return {
      buffer,
      contentType,
      filename: `sundera-redesign-${result.index + 1}.${ext}`,
    };
  }
}
