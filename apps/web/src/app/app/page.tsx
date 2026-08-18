"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhotoDropzone } from "@/components/upload/PhotoDropzone";
import { createUpload } from "@/lib/generations";

export default function AppHomePage() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileReady(file: File) {
    setIsUploading(true);
    setError(null);
    try {
      const upload = await createUpload(file);
      router.push(`/new?photoId=${upload.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload photo",
      );
      setIsUploading(false);
    }
  }

  return (
    <div className="flex min-h-full w-full items-center justify-center px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl">Start a new redesign</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Upload a photo of your room to get a photorealistic redesign.
          </p>
        </div>

        <PhotoDropzone onFileReady={(file) => void handleFileReady(file)} disabled={isUploading} />

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
