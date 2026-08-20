import Image from "next/image";
import {
  DESIGN_STYLES,
  DESIGN_STYLE_LABELS,
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
} from "@sundera/shared";
import { Parallax } from "@/components/landing/Parallax";

export function StyleShowcase() {
  return (
    <section
      id="styles"
      className="border-y border-white/30 bg-muted/50 px-6 py-24 backdrop-blur-md sm:px-8 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            Choose from 14 design styles
          </h2>
          <p className="mt-4 text-muted-foreground">
            Ready to apply to any of 6 room types — living room to kids room.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {DESIGN_STYLES.map((style, index) => (
            <Parallax key={style} speed={index % 2 === 0 ? 0.045 : -0.045} max={26}>
              <div className="group relative aspect-4/3 w-full overflow-hidden rounded-xl border border-white/30">
                <Image
                  src={`/styles/${style.toLowerCase()}.jpg`}
                  alt={DESIGN_STYLE_LABELS[style]}
                  fill
                  sizes="(min-width: 1024px) 14vw, (min-width: 640px) 25vw, 50vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <p className="absolute inset-x-0 bottom-0 border-t border-white/20 bg-black/30 px-2.5 py-2 text-sm font-medium text-white backdrop-blur-md">
                  {DESIGN_STYLE_LABELS[style]}
                </p>
              </div>
            </Parallax>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-2.5">
          {ROOM_TYPES.map((roomType) => (
            <span
              key={roomType}
              className="rounded-full border border-white/40 bg-card/40 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-md"
            >
              {ROOM_TYPE_LABELS[roomType]}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
