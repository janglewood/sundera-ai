import type {
  CreateGenerationRequest,
  CreateGenerationResponse,
  CreateUploadResponse,
  GenerationResponse,
} from "@sundera/shared";
import { apiGet, apiPostForm, apiPostJson } from "./api-client";

export function createUpload(file: File): Promise<CreateUploadResponse> {
  const formData = new FormData();
  formData.append("photo", file);
  return apiPostForm<CreateUploadResponse>("/uploads", formData);
}

export function createGeneration(
  request: CreateGenerationRequest,
): Promise<CreateGenerationResponse> {
  return apiPostJson<CreateGenerationResponse>("/generations", request);
}

export function getGeneration(id: string): Promise<GenerationResponse> {
  return apiGet<GenerationResponse>(`/generations/${id}`);
}
