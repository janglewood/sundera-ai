"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { DesignStyle, RoomType } from "@sundera/shared";
import { RoomTypeGrid } from "@/components/select/RoomTypeGrid";
import { StyleGrid } from "@/components/select/StyleGrid";
import { createGeneration } from "@/lib/generations";

function NewGenerationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const photoId = searchParams.get("photoId");

  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [style, setStyle] = useState<DesignStyle | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!photoId) {
    return (
      <div className="text-center text-foreground/60">
        Missing photo. Please{" "}
        <Link href="/" className="underline">
          upload a room photo
        </Link>{" "}
        first.
      </div>
    );
  }

  async function handleSubmit() {
    if (!photoId || !roomType || !style) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const generation = await createGeneration({
        roomPhotoId: photoId,
        roomType,
        style,
        customPrompt: customPrompt.trim() || undefined,
      });
      router.push(`/generations/${generation.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start generation",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-16">
      <section>
        <h2 className="mb-4 text-lg font-semibold">What room is this?</h2>
        <RoomTypeGrid value={roomType} onChange={setRoomType} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Pick a style</h2>
        <StyleGrid value={style} onChange={setStyle} />
      </section>

      <section>
        <label className="mb-2 block text-sm font-medium">
          Anything else? (optional)
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="e.g. add more plants, keep the wooden floor"
          className="w-full rounded-xl border border-foreground/20 bg-transparent p-3 text-sm"
          rows={3}
        />
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="button"
        disabled={!roomType || !style || isSubmitting}
        onClick={() => void handleSubmit()}
        className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity disabled:opacity-40"
      >
        {isSubmitting ? "Starting…" : "Generate redesign"}
      </button>
    </div>
  );
}

export default function NewGenerationPage() {
  return (
    <Suspense>
      <NewGenerationForm />
    </Suspense>
  );
}
