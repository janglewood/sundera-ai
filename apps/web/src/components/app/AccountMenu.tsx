"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { signOutUser } from "@/lib/auth/auth-actions";
import { usePaywall } from "@/lib/paywall/paywall-context";
import { getMySubscription } from "@/lib/billing";

export function AccountMenu() {
  const { user } = useAuth();
  const { openPaywall } = usePaywall();
  const [isFreePlan, setIsFreePlan] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void getMySubscription().then((subscription) => {
      if (!cancelled) setIsFreePlan(subscription.planTier === "FREE");
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

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
