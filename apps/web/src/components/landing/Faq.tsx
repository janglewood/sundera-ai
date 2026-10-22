import { Plus } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

export function Faq() {
  const t = useTranslations("Faq");
  const faqs = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    question: t(`q${n}question` as "q1question"),
    answer: t(`q${n}answer` as "q1answer"),
  }));

  return (
    <section id="faq" className="px-6 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto w-full max-w-2xl">
        <h2 className="text-center font-display text-3xl tracking-tight sm:text-4xl">
          {t("heading")}
        </h2>

        <div className="mt-10 divide-y divide-white/30 rounded-3xl border border-white/40 bg-card/40 px-6 shadow-lg shadow-black/5 backdrop-blur-xl">
          {faqs.map((faq) => (
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
