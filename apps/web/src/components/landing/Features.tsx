import {
  ArrowsLeftRight,
  ChatCircleDots,
  House,
  ImageSquare,
  LockOpen,
  Swatches,
} from "@phosphor-icons/react/dist/ssr";

const FEATURES = [
  {
    icon: House,
    title: "Your room, not a new one",
    description:
      "Walls, windows, and perspective are preserved — this is your actual room redesigned, not a generic AI render.",
  },
  {
    icon: Swatches,
    title: "14 styles to try",
    description:
      "From Scandinavian to Japanese to Art Deco — swap styles instantly to see what fits before committing.",
  },
  {
    icon: ImageSquare,
    title: "Photorealistic results",
    description:
      "Powered by state-of-the-art image-editing AI, detailed enough to picture yourself living in it.",
  },
  {
    icon: ArrowsLeftRight,
    title: "Before & after, side by side",
    description:
      "An interactive slider shows exactly what changed — furniture, decor, and finishes only.",
  },
  {
    icon: ChatCircleDots,
    title: "Describe what you want",
    description:
      "Add a note like “warmer lighting” or “add a reading nook” and the AI works it into the redesign.",
  },
  {
    icon: LockOpen,
    title: "No credit card needed",
    description:
      "Upload and pick a style free — just a quick sign-up to reveal your redesign.",
  },
];

export function Features() {
  return (
    <section className="px-6 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            Everything you need to reimagine a room
          </h2>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/40 bg-card/40 p-7 shadow-lg shadow-black/5 backdrop-blur-xl transition-shadow hover:shadow-xl dark:border-white/10"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/40 bg-accent-soft/60 text-accent-hover backdrop-blur-md dark:border-white/10">
                <feature.icon size={22} weight="bold" aria-hidden />
              </div>
              <h3 className="mt-5 text-base font-semibold">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
