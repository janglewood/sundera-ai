"use client";

import { ArrowsLeftRight } from "@phosphor-icons/react";
import { useRef, useState } from "react";

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeAlt?: string;
  afterAlt?: string;
  className?: string;
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeAlt = "Original room",
  afterAlt = "Redesigned room",
  className = "",
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  function updateFromClientX(clientX: number) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, ratio)));
  }

  return (
    <div
      ref={containerRef}
      className={`relative aspect-4/3 w-full touch-none select-none overflow-hidden rounded-2xl ${className}`}
      onMouseDown={(e) => {
        isDraggingRef.current = true;
        updateFromClientX(e.clientX);
      }}
      onMouseMove={(e) => {
        if (isDraggingRef.current) updateFromClientX(e.clientX);
      }}
      onMouseUp={() => {
        isDraggingRef.current = false;
      }}
      onMouseLeave={() => {
        isDraggingRef.current = false;
      }}
      onTouchStart={(e) => updateFromClientX(e.touches[0].clientX)}
      onTouchMove={(e) => updateFromClientX(e.touches[0].clientX)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterUrl}
        alt={afterAlt}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      <div
        className="absolute inset-0 h-full overflow-hidden"
        style={{ width: `${position}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt={beforeAlt}
          className="h-full w-full max-w-none object-cover"
          style={{ width: `${(100 / position) * 100 || 0}%` }}
          draggable={false}
        />
      </div>
      <div
        className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-accent shadow-[0_0_0_1px_rgba(255,255,255,0.5)]"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-accent text-accent-foreground shadow-md">
          <ArrowsLeftRight size={16} weight="bold" />
        </div>
      </div>
      <span className="absolute top-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase backdrop-blur-md">
        Before
      </span>
      <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        After
      </span>
    </div>
  );
}
