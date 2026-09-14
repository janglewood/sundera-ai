"use client";

import { useEffect, useState } from "react";
import type { SubscriptionResponse } from "@sundera/shared";
import { useAuth } from "@/lib/auth/auth-context";
import { signOutUser } from "@/lib/auth/auth-actions";
import { usePaywall } from "@/lib/paywall/paywall-context";
import { cancelSubscription, getMySubscription } from "@/lib/billing";

export function AccountMenu() {
  const { user } = useAuth();
  const { openPaywall } = usePaywall();
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(
    null,
  );
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getMySubscription().then((result) => {
      if (!cancelled) setSubscription(result);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isFreePlan = subscription === null || subscription.planTier === "FREE";
  const isActiveSubscriber = subscription?.status === "ACTIVE";
  // Cancelled but still paid through the current period — resolvePlanTier
  // keeps the paid tier active until currentPeriodEnd passes, so reflect
  // that here instead of implying access already ended.
  const isEndingSubscriber = subscription?.status === "CANCELLED" && !isFreePlan;

  async function handleCancel() {
    if (
      !window.confirm(
        "Cancel your subscription? You'll keep your plan until the end of the current billing period, then it won't renew.",
      )
    ) {
      return;
    }
    setIsCancelling(true);
    try {
      const updated = await cancelSubscription();
      setSubscription(updated);
    } catch {
      window.alert("Couldn't cancel your subscription. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2 text-sm sm:gap-3">
      {isFreePlan && (
        <button
          type="button"
          onClick={() => openPaywall("browse")}
          className="mr-1 shrink-0 rounded-full bg-foreground px-2.5 py-1 text-xs font-medium text-background transition-opacity hover:opacity-70 sm:mr-2 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          Upgrade
        </button>
      )}
      {isActiveSubscriber && (
        <button
          type="button"
          onClick={() => void handleCancel()}
          disabled={isCancelling}
          className="mr-1 shrink-0 whitespace-nowrap text-xs font-medium text-foreground/60 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:mr-2 sm:text-sm"
        >
          {isCancelling ? "Cancelling…" : "Cancel subscription"}
        </button>
      )}
      {isEndingSubscriber && subscription?.currentPeriodEnd && (
        <span className="mr-1 hidden shrink-0 whitespace-nowrap text-xs text-foreground/60 sm:mr-2 sm:inline">
          Access until{" "}
          {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
        </span>
      )}
      {(user?.displayName ?? user?.email) && (
        <span className="hidden min-w-0 truncate text-foreground/60 sm:inline sm:max-w-48">
          {user?.displayName ?? user?.email}
        </span>
      )}

      <button
        type="button"
        onClick={() => void signOutUser()}
        className="shrink-0 whitespace-nowrap font-medium text-foreground/60 hover:text-foreground"
      >
        • Sign out
      </button>
    </div>
  );
}
