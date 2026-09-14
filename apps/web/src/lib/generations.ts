import type {
  ClaimGenerationsResponse,
  CreateEditRequest,
  CreateGenerationRequest,
  CreateGenerationResponse,
  CreateUploadResponse,
  GenerationResponse,
  GenerationSummary,
  RenameGenerationRequest,
} from "@sundera/shared";
import {
  apiGet,
  apiGetBlob,
  apiPatchJson,
  apiPostForm,
  apiPostJson,
} from "./api-client";

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

export function renameGeneration(
  id: string,
  request: RenameGenerationRequest,
): Promise<{ id: string; title: string | null }> {
  return apiPatchJson<{ id: string; title: string | null }>(
    `/generations/${id}/title`,
    request,
  );
}

export function claimGenerations(
  generationIds: string[],
): Promise<ClaimGenerationsResponse> {
  return apiPostJson<ClaimGenerationsResponse>("/generations/claim", {
    generationIds,
  });
}

export function downloadGenerationResult(
  generationId: string,
  resultId: string,
): Promise<Blob> {
  return apiGetBlob(
    `/generations/${generationId}/results/${resultId}/download`,
  );
}
