"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PhotoDropzone } from "@/components/upload/PhotoDropzone";
import { createUpload } from "@/lib/generations";
import { useAuth } from "@/lib/auth/auth-context";
import { usePaywall } from "@/lib/paywall/paywall-context";
import { useTokenBalance } from "@/lib/useTokenBalance";
import { track } from "@/lib/analytics/posthog";

function AppHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { openPaywall } = usePaywall();
  const { tokens } = useTokenBalance();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("openPaywall") === "1") {
      openPaywall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleRequestSelect() {
    if (user && tokens && tokens.balance < 1) {
      openPaywall("limit");
      return false;
    }
    return true;
  }

  async function handleFileReady(file: File) {
    setIsUploading(true);
    setError(null);
    try {
      const upload = await createUpload(file);
      track("photo_uploaded", { source: "app_home" });
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

        <PhotoDropzone
          onFileReady={(file) => void handleFileReady(file)}
          onRequestSelect={handleRequestSelect}
          disabled={isUploading}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}

export default function AppHomePage() {
  return (
    <Suspense>
      <AppHome />
    </Suspense>
  );
}
