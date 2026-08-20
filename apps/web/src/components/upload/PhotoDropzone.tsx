"use client";

import { UploadSimple } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

const MAX_DIMENSION = 2000;

const SKIP_DOWNSCALE_TYPES = new Set([
  "image/webp",
  // Browsers can't decode HEIC/HEIF via createImageBitmap; the server
  // transcodes these to JPEG, so just pass the original file through.
  "image/heic",
  "image/heif",
]);

async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || SKIP_DOWNSCALE_TYPES.has(file.type)) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  if (scale === 1) {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, file.type, 0.9),
  );
  if (!blob) return file;

  return new File([blob], file.name, { type: file.type });
}

interface PhotoDropzoneProps {
  onFileReady: (file: File) => void;
  disabled?: boolean;
}

export function PhotoDropzone({ onFileReady, disabled }: PhotoDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isChromeIOS, setIsChromeIOS] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Chrome on iOS (CriOS) has a long-standing bug where camera capture
    // via <input type="file"> shows a black screen; Safari is unaffected.
    setIsChromeIOS(/CriOS/i.test(navigator.userAgent));
  }, []);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const prepared = await downscaleImage(file);
    onFileReady(prepared);
  }

  return (
    <div className="flex items-stretch gap-3">
      <div
        className={`flex h-16 flex-1 flex-row items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 bg-linear-to-br from-accent-soft to-accent-soft/30 p-3 text-center transition-colors sm:h-auto sm:flex-col sm:gap-4 sm:border-dashed sm:bg-none sm:p-10 ${
          isDragging
            ? "border-accent sm:border-foreground sm:bg-foreground/5"
            : "border-accent/40 sm:border-foreground/20"
        } ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Room preview"
            className="max-h-full rounded-lg object-contain sm:max-h-64"
          />
        ) : (
          <>
            <UploadSimple
              size={20}
              weight="bold"
              className="shrink-0 text-accent-hover sm:hidden"
              aria-hidden
            />
            <p className="min-w-0 truncate text-sm font-medium sm:w-auto sm:text-lg">
              <span className="sm:hidden">Upload a photo</span>
              <span className="hidden sm:inline">
                Upload a photo of your room
              </span>
            </p>
            <p className="hidden text-sm text-foreground/60 sm:block">
              Drag and drop, or click to choose a file (JPEG, PNG, WebP, HEIC)
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>

      {!isChromeIOS && (
        <button
          type="button"
          aria-label="Take a photo"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
          className="flex sm:hidden aspect-square w-16 shrink-0 items-center justify-center self-center rounded-2xl bg-accent text-accent-foreground shadow-md transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </button>
      )}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
