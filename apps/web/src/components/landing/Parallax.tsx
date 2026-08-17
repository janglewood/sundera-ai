"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface ParallaxProps {
  /** Positive drifts down relative to scroll, negative drifts up. Keep small (0.05-0.2). */
  speed: number;
  /** Max pixel displacement in either direction, so offscreen elements don't jump. */
  max?: number;
  className?: string;
  children: ReactNode;
}

export function Parallax({ speed, max = 60, className, children }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;

    function apply() {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < -400 || rect.top > window.innerHeight + 400) return;
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const offset = Math.max(
        -max,
        Math.min(max, (viewportCenter - elementCenter) * speed),
      );
      el.style.transform = `translate3d(0, ${offset}px, 0)`;
    }

    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    }

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [speed, max]);

  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}
