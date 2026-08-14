"use client";

import { useRef, useState } from "react";
import type { CreateUploadResponse } from "@sundera/shared";
import {
  createReferenceImageFromUrl,
  createReferenceImageUpload,
} from "@/lib/reference-images";
import { downscaleImage } from "./PhotoDropzone";

const MAX_REFERENCE_IMAGES = 4;

interface ReferenceImagesPickerProps {
  value: CreateUploadResponse[];
  onChange: (next: CreateUploadResponse[]) => void;
  disabled?: boolean;
}

export function ReferenceImagesPicker({
  value,
  onChange,
  disabled,
}: ReferenceImagesPickerProps) {
  const [urlInput, setUrlInput] = useState("");
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [isAddingFiles, setIsAddingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const atLimit = value.length >= MAX_REFERENCE_IMAGES;
  const isBusy = Boolean(disabled) || isAddingUrl || isAddingFiles;

  function remove(id: string) {
    onChange(value.filter((image) => image.id !== id));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const selected = Array.from(files).slice(0, MAX_REFERENCE_IMAGES - value.length);
    setError(null);
    setIsAddingFiles(true);
    try {
      const uploaded: CreateUploadResponse[] = [];
      for (const file of selected) {
        const prepared = await downscaleImage(file);
        uploaded.push(await createReferenceImageUpload(prepared));
      }
      onChange([...value, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add image");
    } finally {
      setIsAddingFiles(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleAddUrl() {
    const url = urlInput.trim();
    if (!url || atLimit) return;
    setError(null);
    setIsAddingUrl(true);
    try {
      const image = await createReferenceImageFromUrl(url);
      onChange([...value, image]);
      setUrlInput("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch image from that link",
      );
    } finally {
      setIsAddingUrl(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((image) => (
            <div
              key={image.id}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-foreground/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.previewUrl}
                alt="Reference"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(image.id)}
                aria-label="Remove reference image"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {!atLimit && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
            className="shrink-0 rounded-full border border-foreground/20 px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {isAddingFiles ? "Uploading…" : "Upload image"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <div className="flex flex-1 gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste a Pinterest or image link"
              disabled={isBusy}
              className="flex-1 rounded-full border border-foreground/20 bg-transparent px-4 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleAddUrl()}
              disabled={isBusy || !urlInput.trim()}
              className="shrink-0 rounded-full bg-foreground/10 px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              {isAddingUrl ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-foreground/50">
        Up to {MAX_REFERENCE_IMAGES} reference images — upload photos or paste
        a link (e.g. Pinterest) to guide the style.
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
