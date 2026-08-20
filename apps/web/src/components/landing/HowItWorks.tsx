import { ChatCircleText, Palette, UploadSimple } from "@phosphor-icons/react/dist/ssr";

const STEPS = [
  {
    icon: UploadSimple,
    number: "01",
    title: "Snap a photo",
    description:
      "Any room, any angle, straight from your phone. JPEG, PNG, or WebP all work.",
  },
  {
    icon: Palette,
    number: "02",
    title: "Pick a room & style",
    description:
      "Choose from 6 room types and 14 design styles, or describe a tweak in your own words.",
  },
  {
    icon: ChatCircleText,
    number: "03",
    title: "Compare before & after",
    description:
      "See your redesigned room in under a minute, then slide between before and after.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-y border-white/30 bg-muted/50 px-6 py-24 backdrop-blur-md sm:px-8 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            No designer, no showroom, no waiting
          </h2>
          <p className="mt-4 text-muted-foreground">
            Three steps between your camera roll and a fully redesigned room.
          </p>
        </div>

        <div className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step) => (
            <div key={step.number} className="text-center sm:text-left">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-accent-soft/60 text-accent-hover backdrop-blur-md sm:mx-0">
                <step.icon size={22} weight="bold" />
              </div>
              <span className="mt-4 block text-xs font-semibold tracking-widest text-muted-foreground">
                STEP {step.number}
              </span>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
