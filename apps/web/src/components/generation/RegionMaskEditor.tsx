"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadSimple, PencilSimple, X } from "@phosphor-icons/react/dist/ssr";
import type { RegionMask, RegionMaskPoint } from "@sundera/shared";
import { VoiceTextarea } from "@/components/shared/VoiceTextarea";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

interface RegionMaskEditorProps {
  beforeUrl: string;
  afterUrl: string;
  onApply: (regionMask: RegionMask, prompt: string) => void;
  isSubmitting: boolean;
  error: string | null;
  onDrawModeChange?: (isDrawing: boolean) => void;
  onDownload: () => void;
  isDownloading: boolean;
  canEdit: boolean;
  onRequestSignUp: () => void;
  // Bumped by the parent right after a sign-up gated on this pencil button
  // succeeds, so the user lands back in draw mode instead of re-clicking.
  autoEnterDrawModeSignal?: number;
}

// Selections smaller than this (in rendered px) are treated as accidental
// taps rather than a real drag.
const MIN_DRAG_PX = 12;
const MIN_FREEHAND_POINTS = 3;

function toPolygonAttr(points: RegionMaskPoint[]): string {
  return points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");
}

// Binomial (3-tap) smoothing over the closed freehand loop — rounds out
// hand-tremor jaggedness from raw pointermove samples without needing to
// resample the curve, so the point count (and therefore payload) is unchanged.
function smoothClosedPath(
  points: RegionMaskPoint[],
  iterations = 3,
): RegionMaskPoint[] {
  let pts = points;
  for (let i = 0; i < iterations && pts.length > 2; i++) {
    pts = pts.map((p, idx) => {
      const prev = pts[(idx - 1 + pts.length) % pts.length];
      const next = pts[(idx + 1) % pts.length];
      return {
        x: (prev.x + p.x * 2 + next.x) / 4,
        y: (prev.y + p.y * 2 + next.y) / 4,
      };
    });
  }
  return pts;
}

function popupAnchorStyle(points: RegionMaskPoint[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const left = `${Math.min(85, Math.max(15, ((minX + maxX) / 2) * 100))}%`;
  const fitsBelow = maxY < 0.78;
  return {
    left,
    top: fitsBelow ? `${maxY * 100}%` : `${minY * 100}%`,
    transform: fitsBelow
      ? "translate(-50%, 12px)"
      : "translate(-50%, calc(-100% - 12px))",
  };
}

export function RegionMaskEditor({
  beforeUrl,
  afterUrl,
  onApply,
  isSubmitting,
  error,
  onDrawModeChange,
  onDownload,
  isDownloading,
  canEdit,
  onRequestSignUp,
  autoEnterDrawModeSignal,
}: RegionMaskEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const polygonElRef = useRef<SVGPolygonElement>(null);
  // The in-progress stroke lives entirely outside React state — every
  // pointermove writes straight to the SVG DOM node, so the line tracks the
  // pointer with zero re-render latency. React only gets involved once, at
  // release, when the smoothed shape becomes `finalizedMask`.
  const rawPointsRef = useRef<RegionMaskPoint[]>([]);
  const isDrawingRef = useRef(false);

  const [isDrawMode, setIsDrawMode] = useState(false);
  const [finalizedMask, setFinalizedMask] = useState<RegionMask | null>(null);
  const [prompt, setPrompt] = useState("");

  function pointFromEvent(e: React.PointerEvent): RegionMaskPoint | null {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  }

  function clearLivePolygon() {
    polygonElRef.current?.setAttribute("points", "");
  }

  function enterDrawMode() {
    rawPointsRef.current = [];
    setFinalizedMask(null);
    setPrompt("");
    setIsDrawMode(true);
    onDrawModeChange?.(true);
  }

  useEffect(() => {
    if (autoEnterDrawModeSignal) enterDrawMode();
    // Only reacts to the signal changing, not to enterDrawMode identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnterDrawModeSignal]);

  function exitDrawMode() {
    isDrawingRef.current = false;
    rawPointsRef.current = [];
    clearLivePolygon();
    setFinalizedMask(null);
    setPrompt("");
    setIsDrawMode(false);
    onDrawModeChange?.(false);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (isSubmitting || finalizedMask) return;
    const point = pointFromEvent(e);
    if (!point) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    isDrawingRef.current = true;
    rawPointsRef.current = [point];
    polygonElRef.current?.setAttribute("points", toPolygonAttr(rawPointsRef.current));
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDrawingRef.current) return;
    const point = pointFromEvent(e);
    if (!point) return;
    rawPointsRef.current.push(point);
    polygonElRef.current?.setAttribute("points", toPolygonAttr(rawPointsRef.current));
  }

  function handlePointerUp() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    const points = rawPointsRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const spreadOk =
      rect &&
      (Math.max(...xs) - Math.min(...xs)) * rect.width > MIN_DRAG_PX &&
      (Math.max(...ys) - Math.min(...ys)) * rect.height > MIN_DRAG_PX;

    if (spreadOk && points.length >= MIN_FREEHAND_POINTS) {
      setFinalizedMask({ shape: "freehand", points: smoothClosedPath(points) });
    } else {
      clearLivePolygon();
    }
    rawPointsRef.current = [];
  }

  function handleCancelSelection() {
    setFinalizedMask(null);
    setPrompt("");
  }

  function handleApply() {
    if (!finalizedMask || !prompt.trim()) return;
    onApply(finalizedMask, prompt.trim());
  }

  if (!isDrawMode) {
    return (
      <div className="relative">
        <BeforeAfterSlider beforeUrl={beforeUrl} afterUrl={afterUrl} />
        <div className="absolute top-14 right-3 z-10 flex flex-col gap-2">
          <div className="group relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!canEdit) {
                  onRequestSignUp();
                  return;
                }
                enterDrawMode();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              aria-label="Draw an area to edit"
              title="Draw an area to edit"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-opacity hover:opacity-80"
            >
              <PencilSimple size={18} weight="bold" />
            </button>
            <span className="pointer-events-none absolute top-1/2 right-full mr-2 -translate-y-1/2 rounded-full bg-black/70 px-2.5 py-1 text-xs whitespace-nowrap text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
              Edit
            </span>
          </div>
          <div className="group relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              disabled={isDownloading}
              aria-label="Download image"
              title="Download image"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              <DownloadSimple size={18} weight="bold" />
            </button>
            <span className="pointer-events-none absolute top-1/2 right-full mr-2 -translate-y-1/2 rounded-full bg-black/70 px-2.5 py-1 text-xs whitespace-nowrap text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
              {isDownloading ? "Preparing…" : "Download"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="relative w-full touch-none select-none overflow-hidden rounded-2xl"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={afterUrl}
          alt="Redesigned room, editable"
          className="block h-auto w-full"
          draggable={false}
        />
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polygon
            ref={polygonElRef}
            points={finalizedMask ? toPolygonAttr(finalizedMask.points) : ""}
            fill="rgba(255,0,0,0.28)"
            stroke="#ff0000"
            strokeWidth={3}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <button
        type="button"
        onClick={exitDrawMode}
        disabled={isSubmitting}
        aria-label="Exit draw mode"
        title="Exit draw mode"
        className="absolute top-14 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-opacity hover:opacity-80 disabled:opacity-40"
      >
        <X size={18} weight="bold" />
      </button>

      {!finalizedMask && (
        <p className="mt-2 text-center text-xs text-foreground/50">
          Draw around the area you want to change.
        </p>
      )}

      {finalizedMask && (
        <div
          className="absolute z-20 w-72 max-w-[calc(100%-1.5rem)] rounded-2xl border border-foreground/10 bg-background p-3 shadow-xl"
          style={popupAnchorStyle(finalizedMask.points)}
        >
          <div className="flex flex-col gap-2">
            <VoiceTextarea
              value={prompt}
              onChange={setPrompt}
              placeholder="e.g. change this rug to a jute one"
              rows={2}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelSelection}
                disabled={isSubmitting}
                className="flex-1 rounded-full border border-foreground/20 px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!prompt.trim() || isSubmitting}
                className="flex-1 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity disabled:opacity-40"
              >
                {isSubmitting ? "Starting…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
