"use client";

import { useRef, useState } from "react";

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
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
      className="relative aspect-4/3 w-full touch-none select-none overflow-hidden rounded-2xl"
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
        alt="Redesigned room"
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
          alt="Original room"
          className="h-full w-full max-w-none object-cover"
          style={{ width: `${(100 / position) * 100 || 0}%` }}
          draggable={false}
        />
      </div>
      <div
        className="absolute inset-y-0 w-1 -translate-x-1/2 bg-white shadow-lg"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md" />
      </div>
      <span className="absolute top-3 left-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
        Before
      </span>
      <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">
        After
      </span>
    </div>
  );
}
