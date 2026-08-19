"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { ROOM_TYPE_LABELS, DESIGN_STYLE_LABELS } from "@sundera/shared";
import type { RoomType, DesignStyle } from "@sundera/shared";
import { usePollGeneration } from "@/lib/use-poll-generation";
import {
  createGenerationEdit,
  downloadGenerationResult,
} from "@/lib/generations";
import { ApiError } from "@/lib/api-client";
import { usePaywall } from "@/lib/paywall/paywall-context";
import { VoiceTextarea } from "@/components/shared/VoiceTextarea";
import { GenerationProgress } from "./GenerationProgress";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

interface GenerationViewProps {
  id: string;
}

function extensionFromUrl(url: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(url);
  return match ? match[1] : "jpg";
}

export function GenerationView({ id }: GenerationViewProps) {
  const router = useRouter();
  const { openPaywall } = usePaywall();
  const { generation, error } = usePollGeneration(id);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-red-500">{error}</p>
        <Link href="/" className="underline">
          Start over
        </Link>
      </div>
    );
  }

  if (!generation) {
    return <GenerationProgress status="PENDING" />;
  }

  if (generation.status === "PENDING" || generation.status === "PROCESSING") {
    return <GenerationProgress status={generation.status} />;
  }

  if (generation.status === "FAILED") {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lg font-medium">Generation failed</p>
        <p className="text-sm text-foreground/60">
          {generation.errorMessage ?? "Something went wrong. Please try again."}
        </p>
        <Link href="/" className="underline">
          Try again
        </Link>
      </div>
    );
  }

  const results = generation.resultImages ?? [];
  const activeResult = results[selectedVariant] ?? results[0];

  async function handleEditSubmit() {
    if (!activeResult || !editPrompt.trim()) return;
    setIsEditSubmitting(true);
    setEditError(null);
    try {
      const edit = await createGenerationEdit(id, {
        sourceResultId: activeResult.id,
        prompt: editPrompt.trim(),
      });
      router.push(`/generations/${edit.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        openPaywall("limit");
      } else {
        setEditError(
          err instanceof Error ? err.message : "Failed to start edit",
        );
      }
      setIsEditSubmitting(false);
    }
  }

  async function handleDownload() {
    if (!activeResult) return;
    setIsDownloading(true);
    try {
      const blob = await downloadGenerationResult(id, activeResult.id);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `sundera-redesign-${activeResult.index + 1}.${extensionFromUrl(activeResult.url)}`;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        openPaywall("limit");
      }
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">
          {ROOM_TYPE_LABELS[generation.roomType as RoomType]} in{" "}
          {DESIGN_STYLE_LABELS[generation.style as DesignStyle]} style
        </h1>
        {generation.isEdit && generation.customPrompt && (
          <p className="mt-1 text-sm text-foreground/60">
            Edited: {generation.customPrompt}
          </p>
        )}
      </div>

      {activeResult && (
        <>
          <BeforeAfterSlider
            beforeUrl={generation.sourceImageUrl}
            afterUrl={activeResult.url}
          />
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={isDownloading}
            className="mx-auto flex items-center gap-2 rounded-full border border-foreground/20 px-6 py-3 font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            <DownloadSimple size={18} weight="bold" />
            {isDownloading ? "Preparing…" : "Download image"}
          </button>
        </>
      )}

      {results.length > 1 && (
        <div className="flex justify-center gap-3">
          {results.map((result) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={result.index}
              src={result.url}
              alt={`Variant ${result.index + 1}`}
              onClick={() => setSelectedVariant(result.index)}
              className={`h-16 w-16 cursor-pointer rounded-lg object-cover ring-2 transition-opacity ${
                result.index === selectedVariant
                  ? "ring-foreground"
                  : "ring-transparent opacity-60"
              }`}
            />
          ))}
        </div>
      )}

      {activeResult && (
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Want to tweak this result?
          </label>
          <VoiceTextarea
            value={editPrompt}
            onChange={setEditPrompt}
            placeholder="e.g. change the sofa to leather"
            rows={3}
          />
          {editError && <p className="text-sm text-red-500">{editError}</p>}
          <button
            type="button"
            disabled={!editPrompt.trim() || isEditSubmitting}
            onClick={() => void handleEditSubmit()}
            className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity disabled:opacity-40"
          >
            {isEditSubmitting ? "Starting…" : "Edit"}
          </button>
        </div>
      )}

      <div className="flex justify-center gap-4 text-sm">
        {generation.isEdit && generation.parentGenerationId && (
          <Link
            href={`/generations/${generation.parentGenerationId}`}
            className="underline"
          >
            Undo last edit
          </Link>
        )}
        <Link href="/" className="underline">
          Start over
        </Link>
      </div>
    </div>
  );
}
