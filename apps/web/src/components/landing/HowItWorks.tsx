import { ChatCircleText, Palette, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

const STEP_ICONS = [UploadSimple, Palette, ChatCircleText];

export function HowItWorks() {
  const t = useTranslations("HowItWorks");
  const steps = [1, 2, 3].map((n) => ({
    icon: STEP_ICONS[n - 1],
    number: `0${n}`,
    title: t(`step${n}Title` as "step1Title"),
    description: t(`step${n}Description` as "step1Description"),
  }));

  return (
    <section
      id="how-it-works"
      className="border-y border-white/30 bg-muted/50 px-6 py-24 backdrop-blur-md sm:px-8 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            {t("heading")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("subheading")}</p>
        </div>

        <div className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-8">
          {steps.map((step) => (
            <div key={step.number} className="text-center sm:text-left">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-accent-soft/60 text-accent-hover backdrop-blur-md sm:mx-0">
                <step.icon size={22} weight="bold" />
              </div>
              <span className="mt-4 block text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {t("stepLabel", { number: step.number })}
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
