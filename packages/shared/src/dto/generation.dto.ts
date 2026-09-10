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
  title: string | null;
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

export interface RegionMaskPoint {
  x: number;
  y: number;
}

export interface RegionMask {
  shape: "freehand" | "rectangle";
  points: RegionMaskPoint[];
}

export interface CreateEditRequest {
  sourceResultId: string;
  prompt: string;
  regionMask?: RegionMask;
}

export interface CreateUploadResponse {
  id: string;
  previewUrl: string;
}

export interface GenerationSummary {
  id: string;
  title: string | null;
  status: GenerationStatus;
  roomType: RoomType;
  style: DesignStyle;
  createdAt: string;
  thumbnailUrl: string;
}

export interface RenameGenerationRequest {
  title: string;
}
