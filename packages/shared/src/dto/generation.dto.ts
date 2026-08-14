import type { RoomType } from "../enums/room-type.enum";
import type { DesignStyle } from "../enums/design-style.enum";
import type { GenerationStatus } from "../enums/generation-status.enum";

export interface CreateGenerationRequest {
  roomPhotoId: string;
  roomType: RoomType;
  style: DesignStyle;
  customPrompt?: string;
}

export interface CreateGenerationResponse {
  id: string;
  status: GenerationStatus;
}

export interface GenerationResultImage {
  id: string;
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
  isEdit: boolean;
  parentGenerationId: string | null;
}

export interface CreateEditRequest {
  sourceResultId: string;
  prompt: string;
}

export interface CreateUploadResponse {
  id: string;
  previewUrl: string;
}
