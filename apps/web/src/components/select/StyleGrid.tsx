"use client";

import Image from "next/image";
import {
  DESIGN_STYLES,
  DESIGN_STYLE_LABELS,
  type DesignStyle,
} from "@sundera/shared";

interface StyleGridProps {
  value: DesignStyle | null;
  onChange: (style: DesignStyle) => void;
}

export function StyleGrid({ value, onChange }: StyleGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {DESIGN_STYLES.map((style) => (
        <button
          key={style}
          type="button"
          onClick={() => onChange(style)}
          className={`group overflow-hidden rounded-xl border text-left transition-colors ${
            value === style
              ? "border-foreground"
              : "border-foreground/20 hover:border-foreground/40"
          }`}
        >
          <div className="relative aspect-4/3 w-full overflow-hidden bg-foreground/5">
            <Image
              src={`/styles/${style.toLowerCase()}.jpg`}
              alt={DESIGN_STYLE_LABELS[style]}
              fill
              sizes="(min-width: 640px) 25vw, 50vw"
              className="object-cover transition-transform group-hover:scale-105"
            />
            {value === style && (
              <div className="absolute inset-0 bg-foreground/20" />
            )}
          </div>
          <div
            className={`px-3 py-2 text-sm font-medium ${
              value === style ? "bg-foreground text-background" : ""
            }`}
          >
            {DESIGN_STYLE_LABELS[style]}
          </div>
        </button>
      ))}
    </div>
  );
}
