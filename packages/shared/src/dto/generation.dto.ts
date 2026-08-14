import type { RoomType } from "../enums/room-type.enum";
import type { DesignStyle } from "../enums/design-style.enum";
import type { GenerationStatus } from "../enums/generation-status.enum";

export interface CreateGenerationRequest {
  roomPhotoId: string;
  roomType: RoomType;
  style: DesignStyle;
  customPrompt?: string;
  referenceImageIds?: string[];
}

export interface CreateGenerationResponse {
  id: string;
  status: GenerationStatus;
}

export interface GenerationResultImage {
  index: number;
  url: string;
}

export interface GenerationResponse {
  id: string;
  status: GenerationStatus;
  roomType: RoomType;
  style: DesignStyle;
  customPrompt: string | null;
  sourceImageUrl: string;
  resultImages: GenerationResultImage[] | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateUploadResponse {
  id: string;
  previewUrl: string;
}

export interface CreateReferenceImageFromUrlRequest {
  url: string;
}
