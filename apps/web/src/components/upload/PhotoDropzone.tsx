"use client";

import { useRef, useState } from "react";

const MAX_DIMENSION = 2000;

export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/webp") {
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
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const prepared = await downscaleImage(file);
    onFileReady(prepared);
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
        isDragging
          ? "border-foreground bg-foreground/5"
          : "border-foreground/20"
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
          className="max-h-64 rounded-lg object-contain"
        />
      ) : (
        <>
          <p className="text-lg font-medium">Upload a photo of your room</p>
          <p className="text-sm text-foreground/60">
            Drag and drop, or click to choose a file (JPEG, PNG, WebP)
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
