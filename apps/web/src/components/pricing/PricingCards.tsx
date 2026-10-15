"use client";

import type { ReactNode } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";
import {
  PAID_PLAN_TIERS,
  PACK_TOKENS,
  PLAN_PRICES_USD,
  type PaidPlanTier,
} from "@sundera/shared";

const COMMON_FEATURES = [
  "Download without watermark",
  "Every design style",
  "Pay once · no subscription · tokens never expire",
];

const PACK_COPY: Record<PaidPlanTier, { title: string; subtitle: string }> = {
  ROOM: { title: "Try it out", subtitle: "Perfect for your first room" },
  ROOMS: { title: "Level up", subtitle: "Great for a few rooms" },
  HOUSE: { title: "Go all in", subtitle: "Redesign your whole home" },
};

export const PRICING_PLANS = PAID_PLAN_TIERS.map((tier) => {
  const tokens = PACK_TOKENS[tier];
  const price = PLAN_PRICES_USD[tier];
  return {
    tier,
    title: PACK_COPY[tier].title,
    subtitle: PACK_COPY[tier].subtitle,
    price,
    tokens,
    pricePerToken: (price / tokens).toFixed(2),
    features: COMMON_FEATURES,
    cta: `Get ${tokens} tokens`,
    ctaShort: "Get tokens",
    highlighted: tier === "ROOMS",
  };
});

export type PricingPlan = (typeof PRICING_PLANS)[number];

export function CtaLabel({ plan }: { plan: PricingPlan }) {
  return (
    <>
      <span className="sm:hidden">{plan.ctaShort}</span>
      <span className="hidden sm:inline">{plan.cta}</span>
    </>
  );
}

export function ctaClassName(highlighted: boolean, compactOnMobile = false) {
  return `${compactOnMobile ? "mt-3 sm:mt-7" : "mt-7"} inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${
    compactOnMobile ? "text-xs sm:text-sm" : ""
  } ${
    highlighted
      ? "bg-accent text-accent-foreground hover:bg-accent-hover disabled:hover:bg-accent"
      : "bg-accent-soft text-accent-hover hover:bg-accent-soft/70 disabled:hover:bg-accent-soft"
  }`;
}

interface PricingCardsProps {
  renderCta: (plan: PricingPlan) => ReactNode;
  compactOnMobile?: boolean;
}

export function PricingCards({
  renderCta,
  compactOnMobile = false,
}: PricingCardsProps) {
  return (
    <div
      className={`grid ${compactOnMobile ? "mt-4 grid-cols-1 gap-2 sm:mt-12 sm:grid-cols-3 sm:gap-4" : "mt-8 grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-4"}`}
    >
      {PRICING_PLANS.map((plan) => (
        <div
          key={plan.tier}
          className={`relative flex flex-col rounded-2xl border shadow-lg shadow-black/5 backdrop-blur-xl ${
            compactOnMobile ? "p-3 sm:p-6" : "p-5 sm:p-6"
          } ${
            plan.highlighted
              ? "border-accent/60 bg-card/60 ring-2 ring-accent"
              : "border-white/40 bg-card/40"
          }`}
        >
          {plan.highlighted && (
            <span
              className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-accent font-semibold text-accent-foreground shadow ${
                compactOnMobile
                  ? "-top-2 px-2 py-0.5 text-[10px] sm:-top-3 sm:px-3 sm:py-1 sm:text-xs"
                  : "-top-3 px-3 py-1 text-xs"
              }`}
            >
              Most popular
            </span>
          )}

          <div
            className={compactOnMobile ? "flex flex-1 gap-3 sm:block" : "flex-1"}
          >
            <div className={compactOnMobile ? "w-2/5 shrink-0" : ""}>
              <h3
                className={`font-semibold ${compactOnMobile ? "text-sm leading-tight sm:text-base" : "text-base"}`}
              >
                {plan.title}
              </h3>
              <p
                className={`mt-1 text-sm text-muted-foreground ${compactOnMobile ? "hidden sm:block" : ""}`}
              >
                {plan.subtitle}
              </p>

              <div
                className={`flex items-baseline gap-1 ${compactOnMobile ? "mt-1.5 sm:mt-5" : "mt-5"}`}
              >
                <span
                  className={`font-display tracking-tight ${compactOnMobile ? "text-xl sm:text-3xl" : "text-3xl"}`}
                >
                  ${plan.price}
                </span>
                <span className="text-sm text-muted-foreground">once</span>
              </div>
              <p
                className={`font-medium text-accent-hover ${compactOnMobile ? "text-[10px] sm:text-xs" : "text-xs"}`}
              >
                {plan.tokens} tokens{" "}
                <span className="font-normal text-muted-foreground">
                  (${plan.pricePerToken}/token)
                </span>
              </p>

              {compactOnMobile && (
                <div className="mt-2 flex flex-col items-center sm:hidden">
                  {renderCta(plan)}
                  <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                    1 token = 1 redesign or 1 edit
                  </p>
                </div>
              )}
            </div>

            <ul
              className={
                compactOnMobile
                  ? "mt-3 min-w-0 flex-1 space-y-1 sm:mt-6 sm:flex-none sm:space-y-3"
                  : "mt-6 space-y-3"
              }
            >
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className={`flex items-start gap-2 ${compactOnMobile ? "text-[11px] sm:text-sm" : "text-sm"}`}
                >
                  <Check
                    weight="bold"
                    aria-hidden
                    className={`mt-0.5 shrink-0 text-accent-hover ${compactOnMobile ? "size-3 sm:size-4" : "size-4"}`}
                  />
                  <span className="text-card-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`flex flex-col items-center ${compactOnMobile ? "hidden sm:flex" : ""}`}
          >
            {renderCta(plan)}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              1 token = 1 redesign or 1 edit
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
