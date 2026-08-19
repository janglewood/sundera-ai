"use client";

import Image from "next/image";
import { Lock } from "@phosphor-icons/react/dist/ssr";
import {
  DESIGN_STYLES,
  DESIGN_STYLE_LABELS,
  type DesignStyle,
} from "@sundera/shared";

interface StyleGridProps {
  value: DesignStyle | null;
  onChange: (style: DesignStyle) => void;
  lockedStyles?: readonly DesignStyle[];
  onLockedSelect?: (style: DesignStyle) => void;
}

export function StyleGrid({
  value,
  onChange,
  lockedStyles = [],
  onLockedSelect,
}: StyleGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {DESIGN_STYLES.map((style) => {
        const isLocked = lockedStyles.includes(style);
        return (
          <button
            key={style}
            type="button"
            onClick={() =>
              isLocked ? onLockedSelect?.(style) : onChange(style)
            }
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
              {isLocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-foreground/50">
                  <Lock size={18} weight="bold" className="text-background" />
                </div>
              )}
            </div>
            <div
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium ${
                value === style ? "bg-foreground text-background" : ""
              }`}
            >
              {DESIGN_STYLE_LABELS[style]}
            </div>
          </button>
        );
      })}
    </div>
  );
}
