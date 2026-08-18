import type {
  CreateEditRequest,
  CreateGenerationRequest,
  CreateGenerationResponse,
  CreateUploadResponse,
  GenerationResponse,
} from "@sundera/shared";
import { apiGet, apiPostForm, apiPostJson, apiUrl } from "./api-client";

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

export function createGenerationEdit(
  id: string,
  request: CreateEditRequest,
): Promise<CreateGenerationResponse> {
  return apiPostJson<CreateGenerationResponse>(
    `/generations/${id}/edit`,
    request,
  );
}

export function getResultDownloadUrl(
  generationId: string,
  resultId: string,
): string {
  return apiUrl(`/generations/${generationId}/results/${resultId}/download`);
}
