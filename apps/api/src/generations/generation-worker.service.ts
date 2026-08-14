import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ROOM_TYPE_LABELS, DESIGN_STYLE_LABELS } from '@sundera/shared';
import type { RoomType, DesignStyle } from '@sundera/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { IMAGE_GENERATION_PROVIDER } from '../image-generation/image-generation.interface';
import type { ImageGenerationProvider } from '../image-generation/image-generation.interface';

interface ClaimedGeneration {
  id: string;
  roomPhotoId: string;
  roomType: string;
  style: string;
  customPrompt: string | null;
}

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function buildPrompt(
  roomType: string,
  style: string,
  customPrompt: string | null,
): string {
  const roomLabel = ROOM_TYPE_LABELS[roomType as RoomType] ?? roomType;
  const styleLabel = DESIGN_STYLE_LABELS[style as DesignStyle] ?? style;
  const base =
    `Redesign this ${roomLabel.toLowerCase()} in ${styleLabel.toLowerCase()} style. ` +
    'Preserve the existing walls, windows, doors, and camera perspective exactly; ' +
    'only change furniture, decor, materials, and color palette.';
  return customPrompt ? `${base} ${customPrompt}` : base;
}

@Injectable()
export class GenerationWorkerService {
  private readonly logger = new Logger(GenerationWorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(IMAGE_GENERATION_PROVIDER)
    private readonly imageGenerationProvider: ImageGenerationProvider,
  ) {}

  @Cron('*/2 * * * * *')
  async tick() {
    const claimed = await this.claimNextPending();
    if (!claimed) {
      return;
    }

    try {
      await this.process(claimed);
    } catch (error) {
      this.logger.error(`Generation ${claimed.id} failed`, error);
      await this.prisma.generation.update({
        where: { id: claimed.id },
        data: {
          status: 'FAILED',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  private async claimNextPending(): Promise<ClaimedGeneration | null> {
    const rows = await this.prisma.$queryRaw<ClaimedGeneration[]>`
      UPDATE "Generation"
      SET status = 'PROCESSING', "startedAt" = now()
      WHERE id = (
        SELECT id FROM "Generation"
        WHERE status = 'PENDING'
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, "roomPhotoId", "roomType", style, "customPrompt"
    `;
    return rows[0] ?? null;
  }

  private async process(claimed: ClaimedGeneration): Promise<void> {
    const roomPhoto = await this.prisma.roomPhoto.findUniqueOrThrow({
      where: { id: claimed.roomPhotoId },
    });

    const sourceBuffer = await this.storage.getObjectBuffer(
      roomPhoto.storageKey,
    );
    const sourceImageDataUrl = `data:${roomPhoto.mimeType};base64,${sourceBuffer.toString('base64')}`;

    const prompt = buildPrompt(
      claimed.roomType,
      claimed.style,
      claimed.customPrompt,
    );

    const variants = await this.imageGenerationProvider.editImage({
      sourceImageDataUrl,
      prompt,
      variantCount: 3,
    });

    for (const [index, variant] of variants.entries()) {
      const ext = MIME_TO_EXT[variant.mimeType] ?? 'png';
      const key = this.storage.buildObjectKey(
        'results',
        claimed.id,
        ext,
        index,
      );
      await this.storage.putObject(key, variant.buffer, variant.mimeType);
      await this.prisma.generationResult.create({
        data: { generationId: claimed.id, storageKey: key, index },
      });
    }

    await this.prisma.generation.update({
      where: { id: claimed.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }
}
