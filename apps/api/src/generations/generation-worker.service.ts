import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import sharp from 'sharp';
import { ROOM_TYPE_LABELS, DESIGN_STYLE_LABELS } from '@sundera/shared';
import type { RoomType, DesignStyle } from '@sundera/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { IMAGE_GENERATION_PROVIDER } from '../image-generation/image-generation.interface';
import type { ImageGenerationProvider } from '../image-generation/image-generation.interface';

interface RegionMaskPoint {
  x: number;
  y: number;
}

interface RegionMask {
  shape: 'freehand' | 'rectangle';
  points: RegionMaskPoint[];
}

interface ClaimedGeneration {
  id: string;
  roomPhotoId: string;
  roomType: string;
  style: string;
  customPrompt: string | null;
  sourceResultId: string | null;
  regionMask: RegionMask | null;
}

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime]),
);

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

function buildEditPrompt(prompt: string): string {
  return `Apply this edit to the image: ${prompt}. Preserve everything else exactly as is.`;
}

function buildRegionEditPrompt(prompt: string): string {
  return (
    `Apply this edit only within the area outlined in red and filled with a translucent red overlay: ${prompt}. ` +
    'Do not change anything outside that area — preserve it exactly, pixel for pixel. ' +
    'The red overlay and outline are only a guide for where to edit; remove them from the final output — they must not appear in the result.'
  );
}

// The configured model has no literal pixel-mask API — masking here means
// burning a visible marker onto the source image and instructing the model
// (via buildRegionEditPrompt) to only edit what's inside it.
async function compositeRegionMask(
  buffer: Buffer,
  mask: RegionMask,
): Promise<Buffer> {
  const { width, height } = await sharp(buffer).metadata();
  if (!width || !height) {
    throw new Error('Could not read source image dimensions for region mask');
  }

  const strokeWidth = Math.max(2, Math.round(Math.max(width, height) * 0.006));
  const polygonPoints = mask.points
    .map(
      (point) =>
        `${(point.x * width).toFixed(1)},${(point.y * height).toFixed(1)}`,
    )
    .join(' ');
  const svg =
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
    `<polygon points="${polygonPoints}" fill="rgba(255,0,0,0.28)" ` +
    `stroke="#ff0000" stroke-width="${strokeWidth}" stroke-linejoin="round" />` +
    '</svg>';

  return sharp(buffer)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
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
      RETURNING id, "roomPhotoId", "roomType", style, "customPrompt", "sourceResultId", "regionMask"
    `;
    return rows[0] ?? null;
  }

  private async process(claimed: ClaimedGeneration): Promise<void> {
    let sourceImageDataUrl: string;
    let prompt: string;

    if (claimed.sourceResultId) {
      const sourceResult = await this.prisma.generationResult.findUniqueOrThrow(
        {
          where: { id: claimed.sourceResultId },
        },
      );
      const sourceBuffer = await this.storage.getObjectBuffer(
        sourceResult.storageKey,
      );

      if (claimed.regionMask) {
        const maskedBuffer = await compositeRegionMask(
          sourceBuffer,
          claimed.regionMask,
        );
        sourceImageDataUrl = `data:image/png;base64,${maskedBuffer.toString('base64')}`;
        prompt = buildRegionEditPrompt(claimed.customPrompt ?? '');
      } else {
        const ext = sourceResult.storageKey.split('.').pop() ?? 'png';
        const mimeType = EXT_TO_MIME[ext] ?? 'image/png';
        sourceImageDataUrl = `data:${mimeType};base64,${sourceBuffer.toString('base64')}`;
        prompt = buildEditPrompt(claimed.customPrompt ?? '');
      }
    } else {
      const roomPhoto = await this.prisma.roomPhoto.findUniqueOrThrow({
        where: { id: claimed.roomPhotoId },
      });
      const sourceBuffer = await this.storage.getObjectBuffer(
        roomPhoto.storageKey,
      );
      sourceImageDataUrl = `data:${roomPhoto.mimeType};base64,${sourceBuffer.toString('base64')}`;
      prompt = buildPrompt(
        claimed.roomType,
        claimed.style,
        claimed.customPrompt,
      );
    }

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
