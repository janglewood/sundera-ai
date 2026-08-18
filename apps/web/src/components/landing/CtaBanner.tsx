"use client";

import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Parallax } from "@/components/landing/Parallax";
import { highlightUpload } from "@/lib/highlightUpload";

export function CtaBanner() {
  return (
    <section className="px-6 py-24 sm:px-8 sm:py-28">
      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-6 overflow-hidden rounded-3xl border border-white/10 bg-primary/85 px-8 py-16 text-center text-primary-foreground shadow-2xl shadow-black/20 backdrop-blur-xl sm:py-20">
        <Parallax
          speed={0.15}
          max={40}
          className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-accent/40 blur-3xl"
        >
          <div />
        </Parallax>
        <Parallax
          speed={-0.1}
          max={40}
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
        >
          <div />
        </Parallax>
        <h2 className="relative z-10 font-display text-3xl tracking-tight sm:text-4xl">
          See your room redesigned in a minute
        </h2>
        <p className="relative z-10 max-w-md text-primary-foreground/70">
          Free to try, no account needed. Upload a photo and pick a style to
          get started.
        </p>
        <a
          href="#upload"
          onClick={highlightUpload}
          className="relative z-10 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-foreground"
        >
          Start redesigning
          <ArrowRight size={18} weight="bold" aria-hidden />
        </a>
      </div>
    </section>
  );
}
