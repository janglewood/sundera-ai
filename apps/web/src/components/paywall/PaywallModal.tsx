"use client";

import { useState } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import {
  CtaLabel,
  PricingCards,
  ctaClassName,
  type PricingPlan,
} from "@/components/pricing/PricingCards";
import type { PaywallReason } from "@/lib/paywall/paywall-context";
import { useIsMobile } from "@/lib/useIsMobile";
import { createCheckout } from "@/lib/billing";
import { markCheckoutPending } from "@/lib/useTokenBalance";
import { track } from "@/lib/analytics/posthog";

const COPY: Record<PaywallReason, { heading: string; subtext: string }> = {
  limit: {
    heading: "You're out of tokens",
    subtext: "Get a pack to continue redesigning and editing.",
  },
  browse: {
    heading: "Get more tokens",
    subtext:
      "Every design style, watermark-free downloads, and tokens that never expire.",
  },
  style: {
    heading: "Unlock every design style",
    subtext:
      "This style is available with a token pack — packs also unlock watermark-free downloads.",
  },
};

interface PaywallModalProps {
  isOpen: boolean;
  reason: PaywallReason;
  tokensBalance: number;
  onClose: () => void;
}

export function PaywallModal({
  isOpen,
  reason,
  tokensBalance,
  onClose,
}: PaywallModalProps) {
  const isMobile = useIsMobile();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  if (!isOpen) return null;

  const { heading, subtext } = COPY[reason];

  async function handleUpgrade(plan: PricingPlan) {
    setCheckoutError(null);
    setLoadingPlan(plan.tier);
    track("upgrade_clicked", {
      planTier: plan.tier,
      price: plan.price,
      tokens: plan.tokens,
    });
    try {
      markCheckoutPending();
      const { paymentUrl } = await createCheckout(plan.tier);
      window.location.href = paymentUrl;
    } catch {
      setCheckoutError("Couldn't start checkout. Please try again.");
      setLoadingPlan(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:overflow-y-auto sm:p-4 sm:py-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Get more tokens"
    >
      <div
        className="relative flex h-full w-full flex-col overflow-y-auto bg-card p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-3xl sm:border sm:border-white/40 sm:p-10 sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sticky top-0 z-10 -mt-1 -mr-1 self-end rounded-full bg-card/90 p-1.5 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted hover:text-foreground sm:absolute sm:top-4 sm:right-4 sm:m-0 sm:self-auto sm:bg-transparent sm:p-1.5 sm:shadow-none sm:backdrop-blur-none"
        >
          <X size={18} weight="bold" className="sm:size-5" />
        </button>

        <div className="mx-auto max-w-xl shrink-0 text-center">
          <p className="text-sm font-medium text-accent-hover">
            You have {tokensBalance} token{tokensBalance === 1 ? "" : "s"}
          </p>
          <h2 className="mt-1 font-display text-lg tracking-tight sm:text-3xl">
            {heading}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-3 sm:text-base">
            {subtext}
          </p>
          {checkoutError && (
            <p className="mt-3 text-sm text-red-500">{checkoutError}</p>
          )}
        </div>

        <PricingCards
          compactOnMobile={isMobile}
          renderCta={(plan) => (
            <button
              type="button"
              disabled={loadingPlan !== null}
              onClick={() => void handleUpgrade(plan)}
              className={ctaClassName(plan.highlighted, isMobile)}
            >
              {loadingPlan === plan.tier ? "Redirecting…" : <CtaLabel plan={plan} />}
            </button>
          )}
        />
      </div>
    </div>
  );
}
