"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";

export type BillingCycle = "monthly" | "annual";

export const PRICING_PLANS = [
  {
    name: "Free",
    tagline: "Try it out",
    monthlyPrice: 0,
    annualPrice: 0,
    features: ["1 room redesign", "1 edit", "A few design styles"],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Starter",
    tagline: "A full room refresh",
    monthlyPrice: 12,
    annualPrice: 10,
    features: [
      "30 room redesigns a month",
      "Up to 5 edits per redesign",
      "Download your redesigns",
      "Every design style",
    ],
    cta: "Get started",
    highlighted: true,
  },
  {
    name: "Pro",
    tagline: "Redesign every room",
    monthlyPrice: 20,
    annualPrice: 17,
    features: [
      "Unlimited room redesigns",
      "Unlimited edits per redesign",
      "Download your redesigns",
      "Every design style",
    ],
    cta: "Get started",
    highlighted: false,
  },
] as const;

export type PricingPlan = (typeof PRICING_PLANS)[number];

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
  renderCta: (plan: PricingPlan, cycle: BillingCycle) => ReactNode;
  compactOnMobile?: boolean;
}

export function PricingCards({
  renderCta,
  compactOnMobile = false,
}: PricingCardsProps) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const isAnnual = cycle === "annual";

  return (
    <>
      <div
        className={`flex items-center justify-center gap-4 ${compactOnMobile ? "mt-4 sm:mt-10" : "mt-6 sm:mt-10"}`}
      >
        <span
          className={`text-sm font-medium ${isAnnual ? "text-muted-foreground" : "text-foreground"}`}
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isAnnual}
          onClick={() => setCycle(isAnnual ? "monthly" : "annual")}
          className="relative h-7 w-12 shrink-0 rounded-full bg-accent-soft transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span
            className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-accent shadow transition-transform ${isAnnual ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
        <span
          className={`text-sm font-medium ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}
        >
          Annual
        </span>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-hover">
          Save up to 30%
        </span>
      </div>

      <div
        className={`grid ${compactOnMobile ? "mt-4 grid-cols-1 gap-2 sm:mt-12 sm:grid-cols-3 sm:gap-6" : "mt-8 grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-6"}`}
      >
        {PRICING_PLANS.map((plan) => {
          const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
          return (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border shadow-lg shadow-black/5 backdrop-blur-xl ${
                compactOnMobile ? "p-3 sm:p-7" : "p-5 sm:p-7"
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
                className={
                  compactOnMobile ? "flex flex-1 gap-3 sm:block" : "flex-1"
                }
              >
                <div className={compactOnMobile ? "w-2/5 shrink-0" : ""}>
                  <h3
                    className={`font-semibold ${compactOnMobile ? "text-sm leading-tight sm:text-base" : "text-base"}`}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className={`mt-1 text-sm text-muted-foreground ${compactOnMobile ? "hidden sm:block" : ""}`}
                  >
                    {plan.tagline}
                  </p>

                  <div
                    className={`flex items-baseline gap-1 ${compactOnMobile ? "mt-1.5 sm:mt-5" : "mt-5"}`}
                  >
                    <span
                      className={`font-display tracking-tight ${compactOnMobile ? "text-xl sm:text-3xl" : "text-3xl"}`}
                    >
                      ${price}
                    </span>
                    {price > 0 && (
                      <span className="text-sm text-muted-foreground">
                        /month
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-1 text-xs text-muted-foreground ${
                      price > 0 && isAnnual ? "" : "invisible"
                    } ${compactOnMobile ? "hidden sm:block" : ""}`}
                  >
                    Billed annually
                  </p>

                  {compactOnMobile && (
                    <div className="mt-2 sm:hidden">
                      {renderCta(plan, cycle)}
                      {plan.monthlyPrice > 0 && (
                        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                          Cancel anytime
                        </p>
                      )}
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

              <div className={compactOnMobile ? "hidden sm:block" : ""}>
                {renderCta(plan, cycle)}
                {plan.monthlyPrice > 0 && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Cancel anytime
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
