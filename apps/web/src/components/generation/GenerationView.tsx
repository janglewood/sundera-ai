"use client";

import Link from "next/link";
import { useState } from "react";
import { ROOM_TYPE_LABELS, DESIGN_STYLE_LABELS } from "@sundera/shared";
import type { RoomType, DesignStyle } from "@sundera/shared";
import { usePollGeneration } from "@/lib/use-poll-generation";
import { GenerationProgress } from "./GenerationProgress";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

interface GenerationViewProps {
  id: string;
}

export function GenerationView({ id }: GenerationViewProps) {
  const { generation, error } = usePollGeneration(id);
  const [selectedVariant, setSelectedVariant] = useState(0);

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

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">
          {ROOM_TYPE_LABELS[generation.roomType as RoomType]} in{" "}
          {DESIGN_STYLE_LABELS[generation.style as DesignStyle]} style
        </h1>
      </div>

      {activeResult && (
        <BeforeAfterSlider
          beforeUrl={generation.sourceImageUrl}
          afterUrl={activeResult.url}
        />
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

      <div className="flex justify-center gap-4 text-sm">
        <Link href="/" className="underline">
          Start over
        </Link>
      </div>
    </div>
  );
}
