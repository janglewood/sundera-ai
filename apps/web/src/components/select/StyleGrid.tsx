"use client";

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
          className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
            value === style
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/20 hover:border-foreground/40"
          }`}
        >
          {DESIGN_STYLE_LABELS[style]}
        </button>
      ))}
    </div>
  );
}
