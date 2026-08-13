export interface ImageEditRequest {
  /** Base64 data URL of the source room photo, e.g. "data:image/jpeg;base64,..." */
  sourceImageDataUrl: string;
  prompt: string;
  variantCount: number;
}

export interface ImageEditResultVariant {
  buffer: Buffer;
  mimeType: string;
}

export const IMAGE_GENERATION_PROVIDER = Symbol('IMAGE_GENERATION_PROVIDER');

export interface ImageGenerationProvider {
  editImage(request: ImageEditRequest): Promise<ImageEditResultVariant[]>;
}
