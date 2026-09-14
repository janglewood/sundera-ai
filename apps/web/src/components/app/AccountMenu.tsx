"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SubscriptionResponse } from "@sundera/shared";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
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
  const [isOpen, setIsOpen] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const isFreePlan = subscription === null || subscription.planTier === "FREE";
  const isActiveSubscriber = subscription?.status === "ACTIVE";
  const planLabel = subscription
    ? subscription.planTier.charAt(0) +
      subscription.planTier.slice(1).toLowerCase()
    : "Free";
  // Cancelled but still paid through the current period — resolvePlanTier
  // keeps the paid tier active until currentPeriodEnd passes, so reflect
  // that here instead of implying access already ended.
  const isEndingSubscriber =
    subscription?.status === "CANCELLED" && !isFreePlan;

  async function handleCancel() {
    setCancelError(null);
    setIsCancelling(true);
    try {
      const updated = await cancelSubscription();
      setSubscription(updated);
      setShowCancelConfirm(false);
    } catch {
      setCancelError("Couldn't cancel your subscription. Please try again.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-foreground/10 bg-background px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
        >
          Account
          <CaretDown
            weight="bold"
            className={`size-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div
            role="menu"
            className="absolute top-full right-0 z-20 mt-2 w-64 rounded-2xl border border-white/40 bg-card p-2 text-sm shadow-2xl backdrop-blur-xl"
          >
            {(user?.displayName ?? user?.email) && (
              <div className="flex items-center justify-between gap-2 px-2 pt-1.5 pb-2">
                <p className="truncate text-foreground/60">
                  {user?.displayName ?? user?.email}
                </p>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/70">
                  {planLabel}
                </span>
              </div>
            )}

            <div className="space-y-0.5 border-t border-foreground/10 pt-2">
              {isFreePlan && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    openPaywall("browse");
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-left font-medium text-foreground hover:bg-muted"
                >
                  Upgrade
                </button>
              )}
              {isActiveSubscriber && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setCancelError(null);
                    setShowCancelConfirm(true);
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-red-600 hover:bg-red-500/10"
                >
                  Cancel subscription
                </button>
              )}
              {isEndingSubscriber && subscription?.currentPeriodEnd && (
                <p className="px-2 py-1.5 text-foreground/60">
                  Access until{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="mt-4 pt-2">
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="w-full rounded-lg px-2 py-1.5 text-left font-medium text-foreground hover:bg-muted"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {showCancelConfirm &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => !isCancelling && setShowCancelConfirm(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Cancel subscription"
          >
            <div
              className="w-full max-w-sm rounded-3xl border border-white/40 bg-card p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="font-display text-lg tracking-tight">
                Cancel subscription?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You&apos;ll keep your plan until the end of the current
                billing period, then it won&apos;t renew.
              </p>
              {cancelError && (
                <p className="mt-3 text-sm text-red-500">{cancelError}</p>
              )}
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={isCancelling}
                  className="rounded-full px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Keep subscription
                </button>
                <button
                  type="button"
                  onClick={() => void handleCancel()}
                  disabled={isCancelling}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCancelling ? "Cancelling…" : "Cancel subscription"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
