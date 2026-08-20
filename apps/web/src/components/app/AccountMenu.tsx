"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { signOutUser } from "@/lib/auth/auth-actions";
import { usePaywall } from "@/lib/paywall/paywall-context";
import { getMySubscription } from "@/lib/billing";

export function AccountMenu() {
  const { user } = useAuth();
  const { openPaywall } = usePaywall();
  const [isFreePlan, setIsFreePlan] = useState(false);

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
    <div className="flex items-center gap-3 text-sm">
      {isFreePlan && (
        <button
          type="button"
          onClick={() => openPaywall("browse")}
          className="mr-2 shrink-0 rounded-full bg-foreground px-3 py-1.5 font-medium text-background transition-opacity hover:opacity-70"
        >
          Upgrade
        </button>
      )}
      <span className="max-w-[12rem] truncate text-foreground/60">
        {user?.displayName ?? user?.email}
      </span>

      <button
        type="button"
        onClick={() => void signOutUser()}
        className="shrink-0 font-medium text-foreground/60 hover:text-foreground"
      >
        • Sign out
      </button>
    </div>
  );
}
