import type {
  CreateEditRequest,
  CreateGenerationRequest,
  CreateGenerationResponse,
  CreateUploadResponse,
  GenerationResponse,
  GenerationSummary,
} from "@sundera/shared";
import { apiGet, apiGetBlob, apiPostForm, apiPostJson } from "./api-client";

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

export function listMyGenerations(): Promise<GenerationSummary[]> {
  return apiGet<GenerationSummary[]>("/generations/mine");
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

export function downloadGenerationResult(
  generationId: string,
  resultId: string,
): Promise<Blob> {
  return apiGetBlob(
    `/generations/${generationId}/results/${resultId}/download`,
  );
}
