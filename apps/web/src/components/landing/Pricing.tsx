"use client";

import Link from "next/link";
import {
  CtaLabel,
  PricingCards,
  ctaClassName,
} from "@/components/pricing/PricingCards";
import { highlightUpload } from "@/lib/highlightUpload";

export function Pricing() {
  return (
    <section id="pricing" className="px-6 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            Simple pricing, pay once
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start free. Upgrade with a one-time payment for more generations,
            edits, and styles.
          </p>
        </div>

        <PricingCards
          renderCta={(plan) =>
            plan.name === "Free" ? (
              <a
                href="#upload"
                onClick={highlightUpload}
                className={ctaClassName(plan.highlighted)}
              >
                <CtaLabel plan={plan} />
              </a>
            ) : (
              <Link
                href="/login?next=paywall"
                className={ctaClassName(plan.highlighted)}
              >
                <CtaLabel plan={plan} />
              </Link>
            )
          }
        />
      </div>
    </section>
  );
}
