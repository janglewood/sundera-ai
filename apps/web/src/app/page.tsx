"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhotoDropzone } from "@/components/upload/PhotoDropzone";
import { createUpload } from "@/lib/generations";

export default function Home() {
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          See your room, redesigned
        </h1>
        <p className="mt-3 text-foreground/60">
          Upload a photo of your room and preview it in a new style in
          seconds.
        </p>
      </div>

      <div className="w-full">
        <PhotoDropzone onFileReady={handleFileReady} disabled={isUploading} />
        {isUploading && (
          <p className="mt-3 text-center text-sm text-foreground/60">
            Uploading…
          </p>
        )}
        {error && (
          <p className="mt-3 text-center text-sm text-red-500">{error}</p>
        )}
      </div>
    </main>
  );
}
