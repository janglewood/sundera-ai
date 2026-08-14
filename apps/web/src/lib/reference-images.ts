import type { CreateUploadResponse } from "@sundera/shared";
import { apiPostForm, apiPostJson } from "./api-client";

export function createReferenceImageUpload(
  file: File,
): Promise<CreateUploadResponse> {
  const formData = new FormData();
  formData.append("image", file);
  return apiPostForm<CreateUploadResponse>("/reference-images", formData);
}

export function createReferenceImageFromUrl(
  url: string,
): Promise<CreateUploadResponse> {
  return apiPostJson<CreateUploadResponse>("/reference-images/from-url", {
    url,
  });
}
