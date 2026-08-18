"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { highlightUpload } from "@/lib/highlightUpload";

type BillingCycle = "monthly" | "annual";

const PLANS = [
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
    tagline: "For a full room refresh",
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
    tagline: "For redesigning every room",
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

export function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const isAnnual = cycle === "annual";

  return (
    <section id="pricing" className="px-6 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            Simple pricing, cancel anytime
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start free. Upgrade when you want more generations, edits, and
            styles.
          </p>
        </div>

        <div className="mt-10 flex items-center justify-center gap-3">
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
            className="relative h-7 w-12 shrink-0 rounded-full bg-accent-soft transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:bg-white/10"
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
            Save up to 17%
          </span>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
            return (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-7 shadow-lg shadow-black/5 backdrop-blur-xl ${
                  plan.highlighted
                    ? "border-accent/60 bg-card/60 ring-2 ring-accent"
                    : "border-white/40 bg-card/40 dark:border-white/10"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground shadow">
                    Most popular
                  </span>
                )}

                <h3 className="text-base font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.tagline}
                </p>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-3xl tracking-tight">
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
                  }`}
                >
                  Billed annually
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check
                        size={16}
                        weight="bold"
                        aria-hidden
                        className="mt-0.5 shrink-0 text-accent-hover"
                      />
                      <span className="text-card-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#upload"
                  onClick={highlightUpload}
                  className={`mt-7 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    plan.highlighted
                      ? "bg-accent text-accent-foreground hover:bg-accent-hover"
                      : "bg-accent-soft text-accent-hover hover:bg-accent-soft/70"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
