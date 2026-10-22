"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  CtaLabel,
  PricingCards,
  ctaClassName,
} from "@/components/pricing/PricingCards";
import { highlightUpload } from "@/lib/highlightUpload";

export function Pricing() {
  const t = useTranslations("Pricing");

  return (
    <section id="pricing" className="px-6 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            {t("heading")}
          </h2>
          <p className="mt-4 text-muted-foreground">{t("subheading")}</p>
        </div>

        <PricingCards
          renderCta={(plan) => (
            <Link
              href="/login?next=paywall"
              className={ctaClassName(plan.highlighted)}
            >
              <CtaLabel plan={plan} />
            </Link>
          )}
        />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("freeLine")}{" "}
          <a href="#upload" onClick={highlightUpload} className="underline">
            {t("tryItFree")}
          </a>
        </p>
      </div>
    </section>
  );
}
