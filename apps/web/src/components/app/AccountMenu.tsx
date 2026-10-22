"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { useAuth } from "@/lib/auth/auth-context";
import { signOutUser } from "@/lib/auth/auth-actions";
import { usePaywall } from "@/lib/paywall/paywall-context";
import { useTokenBalance } from "@/lib/useTokenBalance";

export function AccountMenu() {
  const t = useTranslations("AccountMenu");
  const tPlanTier = useTranslations("PlanTiers");
  const { user } = useAuth();
  const { openPaywall } = usePaywall();
  const { tokens } = useTokenBalance();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const planLabel = tPlanTier(tokens?.planTier ?? "FREE");
  const balance = tokens?.balance ?? 0;

  return (
    <div className="relative flex items-center gap-2" ref={menuRef}>
      <button
        type="button"
        onClick={() => openPaywall("browse")}
        className="shrink-0 rounded-full border border-foreground/10 bg-background px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
      >
        {t("tokens", { count: balance })}
      </button>

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-foreground/10 bg-background px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
      >
        {t("account")}
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
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openPaywall("browse");
              }}
              className="w-full rounded-lg px-2 py-1.5 text-left font-medium text-foreground hover:bg-muted"
            >
              {t("getMoreTokens")}
            </button>
          </div>

          <div className="mt-4 pt-2">
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="w-full rounded-lg px-2 py-1.5 text-left font-medium text-foreground hover:bg-muted"
            >
              {t("signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
