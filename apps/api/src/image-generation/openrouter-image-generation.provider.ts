import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ImageEditRequest,
  ImageEditResultVariant,
  ImageGenerationProvider,
} from './image-generation.interface';

const REQUEST_TIMEOUT_MS = 60_000;

interface OpenRouterImageResponse {
  data: Array<{ b64_json: string; media_type: string }>;
}

@Injectable()
export class OpenRouterImageGenerationProvider implements ImageGenerationProvider {
  private readonly logger = new Logger(OpenRouterImageGenerationProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('OPENROUTER_API_KEY');
    this.model = this.configService.getOrThrow<string>('OPENROUTER_MODEL');
    this.baseUrl = this.configService.getOrThrow<string>('OPENROUTER_BASE_URL');
  }

  async editImage(request: ImageEditRequest): Promise<ImageEditResultVariant[]> {
    // Image-editing mode (input_references present) only supports n=1 per
    // request on this model/provider — fire one request per desired variant
    // instead of batching via `n`.
    const variants = await Promise.all(
      Array.from({ length: request.variantCount }, () =>
        this.editImageOnce(request.sourceImageDataUrl, request.prompt),
      ),
    );
    return variants.flat();
  }

  private async editImageOnce(
    sourceImageDataUrl: string,
    prompt: string,
  ): Promise<ImageEditResultVariant[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/images`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          n: 1,
          input_references: [
            {
              type: 'image_url',
              image_url: { url: sourceImageDataUrl },
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new InternalServerErrorException(
          `OpenRouter image generation failed (${response.status}): ${body}`,
        );
      }

      const payload = (await response.json()) as OpenRouterImageResponse;
      return payload.data.map((variant) => ({
        buffer: Buffer.from(variant.b64_json, 'base64'),
        mimeType: variant.media_type,
      }));
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new InternalServerErrorException(
          `OpenRouter image generation timed out after ${REQUEST_TIMEOUT_MS}ms`,
        );
      }
      this.logger.error('OpenRouter image generation request failed', error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
