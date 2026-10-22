import {
  ArrowsLeftRight,
  ChatCircleDots,
  House,
  ImageSquare,
  LockOpen,
  Swatches,
} from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";

const FEATURE_ICONS = [House, Swatches, ImageSquare, ArrowsLeftRight, ChatCircleDots, LockOpen];

export function Features() {
  const t = useTranslations("Features");
  const features = [1, 2, 3, 4, 5, 6].map((n) => ({
    icon: FEATURE_ICONS[n - 1],
    title: t(`f${n}Title` as "f1Title"),
    description: t(`f${n}Description` as "f1Description"),
  }));

  return (
    <section className="px-6 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            {t("heading")}
          </h2>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/40 bg-card/40 p-7 shadow-lg shadow-black/5 backdrop-blur-xl transition-shadow hover:shadow-xl"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/40 bg-accent-soft/60 text-accent-hover backdrop-blur-md">
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
