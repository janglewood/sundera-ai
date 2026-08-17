import { Plus } from "@phosphor-icons/react/dist/ssr";

const FAQS = [
  {
    question: "Do I need to create an account?",
    answer:
      "No. Upload a photo and start redesigning right away — no sign-up required.",
  },
  {
    question: "Will it change the structure of my room?",
    answer:
      "No. Walls, windows, and the room's layout stay exactly where they are — only furniture, decor, and finishes change.",
  },
  {
    question: "What photos work best?",
    answer:
      "A well-lit, straight-on photo of the room works best. JPEG, PNG, and WebP are all supported.",
  },
  {
    question: "How long does a redesign take?",
    answer: "Usually under a minute from upload to result.",
  },
  {
    question:
      "Can I ask for something specific, like a color or a piece of furniture?",
    answer:
      "Yes — after picking a room type and style, there's a free-text field to describe any tweak you want included.",
  },
  {
    question: "Is it free?",
    answer: "Yes — Sundera AI doesn't have any paid plans yet.",
  },
  {
    question: "What happens to my photos?",
    answer: "Your photos are used only to generate your redesign.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="px-6 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto w-full max-w-2xl">
        <h2 className="text-center font-display text-3xl tracking-tight sm:text-4xl">
          Frequently asked questions
        </h2>

        <div className="mt-10 divide-y divide-white/30 rounded-3xl border border-white/40 bg-card/40 px-6 shadow-lg shadow-black/5 backdrop-blur-xl dark:divide-white/10 dark:border-white/10">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:content-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                {faq.question}
                <Plus
                  size={18}
                  weight="bold"
                  aria-hidden
                  className="shrink-0 text-accent transition-transform duration-200 group-open:rotate-45"
                />
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
