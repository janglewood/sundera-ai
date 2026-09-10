import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PLAN_LIMITS, isStyleAllowedForPlan } from '@sundera/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { CreateEditGenerationDto } from './dto/create-edit-generation.dto';
import { PaywallRequiredException } from './paywall-required.exception';

@Injectable()
export class GenerationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly configService: ConfigService,
    private readonly payments: PaymentsService,
  ) {}

  async create(dto: CreateGenerationDto, userId?: string) {
    const roomPhoto = await this.prisma.roomPhoto.findUnique({
      where: { id: dto.roomPhotoId },
    });
    if (!roomPhoto) {
      throw new NotFoundException(`RoomPhoto not found: ${dto.roomPhotoId}`);
    }

    // Anonymous (no userId) requests are left unlimited for now.
    if (userId) {
      const planTier = await this.payments.resolvePlanTier(userId);
      const limits = PLAN_LIMITS[planTier];

      if (!isStyleAllowedForPlan(dto.style, planTier)) {
        throw new PaywallRequiredException(
          'This style is available on paid plans.',
        );
      }

      const generationCount = await this.prisma.generation.count({
        where: { userId, sourceResultId: null },
      });
      if (generationCount >= limits.maxGenerations) {
        throw new PaywallRequiredException(
          planTier === 'FREE'
            ? "You've used your free redesign. Upgrade to create more."
            : "You've reached your plan's redesign limit. Upgrade for more.",
        );
      }
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

    if (userId) {
      const planTier = await this.payments.resolvePlanTier(userId);
      const editCount = await this.countChainEdits(userId, parentGenerationId);
      if (editCount >= PLAN_LIMITS[planTier].maxEdits) {
        throw new PaywallRequiredException(
          planTier === 'FREE'
            ? "You've used your free edit. Upgrade for more edits."
            : "You've reached your plan's edit limit. Upgrade for more.",
        );
      }
    }

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        roomPhotoId: parent.roomPhotoId,
        roomType: parent.roomType,
        style: parent.style,
        customPrompt: dto.prompt,
        regionMask: dto.regionMask
          ? {
              shape: dto.regionMask.shape,
              points: dto.regionMask.points.map((point) => ({
                x: point.x,
                y: point.y,
              })),
            }
          : undefined,
        sourceResultId: sourceResult.id,
        model: this.configService.getOrThrow<string>('OPENROUTER_MODEL'),
      },
    });

    return { id: generation.id, status: generation.status };
  }

  // Edits create their own Generation row (sourceResultId pointing at the
  // result they were edited from), so a "chain" is a tree of Generation rows
  // linked one hop at a time via sourceResultId -> GenerationResult.generationId.
  // There's no flat root/chain-id column, so callers that need the whole
  // chain (sidebar collapsing, per-generation edit limits) walk it in memory.
  private async loadGenerationGraph(userId: string) {
    const generations = await this.prisma.generation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        roomPhoto: true,
        results: { orderBy: { index: 'asc' } },
      },
    });

    const generationByResultId = new Map<string, (typeof generations)[number]>();
    for (const generation of generations) {
      for (const result of generation.results) {
        generationByResultId.set(result.id, generation);
      }
    }

    return { generations, generationByResultId };
  }

  private findRootId(
    generation: { id: string; sourceResultId: string | null },
    generationByResultId: Map<string, { id: string; sourceResultId: string | null }>,
  ): string {
    let current = generation;
    while (current.sourceResultId) {
      const parent = generationByResultId.get(current.sourceResultId);
      if (!parent) break;
      current = parent;
    }
    return current.id;
  }

  // Standalone version of findRootId that doesn't need a preloaded user
  // graph — walks sourceResultId -> GenerationResult.generationId one hop
  // at a time via direct queries. Used for rename, where the target chain
  // may belong to an anonymous (userId === null) generation.
  private async findRootGenerationId(generationId: string): Promise<string> {
    type Node = { id: string; sourceResultId: string | null };
    let current: Node | null = await this.prisma.generation.findUnique({
      where: { id: generationId },
      select: { id: true, sourceResultId: true },
    });
    if (!current) {
      throw new NotFoundException(`Generation not found: ${generationId}`);
    }
    let rootId = current.id;
    while (current?.sourceResultId) {
      const parentResult = await this.prisma.generationResult.findUnique({
        where: { id: current.sourceResultId },
        select: { generationId: true },
      });
      if (!parentResult) break;
      current = await this.prisma.generation.findUnique({
        where: { id: parentResult.generationId },
        select: { id: true, sourceResultId: true },
      });
      if (current) rootId = current.id;
    }
    return rootId;
  }

  async renameGeneration(generationId: string, title: string, userId?: string) {
    const generation = await this.prisma.generation.findUnique({
      where: { id: generationId },
    });
    if (!generation) {
      throw new NotFoundException(`Generation not found: ${generationId}`);
    }
    if (generation.userId && generation.userId !== userId) {
      throw new ForbiddenException('You do not own this generation');
    }

    const rootId = await this.findRootGenerationId(generationId);
    const root = await this.prisma.generation.update({
      where: { id: rootId },
      data: { title },
    });
    return { id: root.id, title: root.title };
  }

  private async countChainEdits(
    userId: string,
    generationId: string,
  ): Promise<number> {
    const { generations, generationByResultId } =
      await this.loadGenerationGraph(userId);

    const generation = generations.find((g) => g.id === generationId);
    if (!generation) return 0;
    const rootId = this.findRootId(generation, generationByResultId);

    // Count every descendant in the tree rooted at rootId: BFS down via
    // each generation's results, following sourceResultId edges to children.
    const childrenByResultId = new Map<string, (typeof generations)[number][]>();
    for (const candidate of generations) {
      if (!candidate.sourceResultId) continue;
      const siblings = childrenByResultId.get(candidate.sourceResultId) ?? [];
      siblings.push(candidate);
      childrenByResultId.set(candidate.sourceResultId, siblings);
    }
    const generationById = new Map(generations.map((g) => [g.id, g]));

    let count = 0;
    const queue = [rootId];
    while (queue.length) {
      const currentId = queue.shift()!;
      const current = generationById.get(currentId);
      if (!current) continue;
      for (const result of current.results) {
        const children = childrenByResultId.get(result.id) ?? [];
        for (const child of children) {
          count++;
          queue.push(child.id);
        }
      }
    }
    return count;
  }

  async findByUser(userId: string) {
    const { generations, generationByResultId } =
      await this.loadGenerationGraph(userId);

    // For the sidebar we want one entry per edit chain rather than one per
    // row, so collapse each chain down to its most recent generation. The
    // custom title (if any) always lives on the chain's root row, so it
    // survives further edits creating new "latest" rows.
    const generationById = new Map(generations.map((g) => [g.id, g]));
    const latestByRootId = new Map<
      string,
      { rootId: string; generation: (typeof generations)[number] }
    >();
    for (const generation of generations) {
      const rootId = this.findRootId(generation, generationByResultId);
      const latest = latestByRootId.get(rootId);
      if (!latest || generation.createdAt > latest.generation.createdAt) {
        latestByRootId.set(rootId, { rootId, generation });
      }
    }

    const latestEntries = [...latestByRootId.values()].sort(
      (a, b) => b.generation.createdAt.getTime() - a.generation.createdAt.getTime(),
    );

    return Promise.all(
      latestEntries.map(async ({ rootId, generation }) => ({
        id: generation.id,
        title: generationById.get(rootId)?.title ?? null,
        status: generation.status,
        roomType: generation.roomType,
        style: generation.style,
        createdAt: generation.createdAt.toISOString(),
        thumbnailUrl: await this.storage.getPresignedGetUrl(
          generation.results[0]?.storageKey ?? generation.roomPhoto.storageKey,
        ),
      })),
    );
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
      generation.roomPhoto.storageKey,
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

    // The custom title always lives on the chain's root row (see
    // renameGeneration) — resolve it even when viewing a downstream edit.
    const title = generation.sourceResultId
      ? (
          await this.prisma.generation.findUnique({
            where: { id: await this.findRootGenerationId(id) },
            select: { title: true },
          })
        )?.title ?? null
      : generation.title;

    return {
      id: generation.id,
      title,
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

  async getResultFile(
    generationId: string,
    resultId: string,
    userId?: string,
  ) {
    const planTier = await this.payments.resolvePlanTier(userId);
    if (!PLAN_LIMITS[planTier].downloadsAllowed) {
      throw new PaywallRequiredException('Downloads are available on paid plans.');
    }

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
