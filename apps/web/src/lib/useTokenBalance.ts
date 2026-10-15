"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TokensResponse } from "@sundera/shared";
import { useAuth } from "@/lib/auth/auth-context";
import { getMyTokens } from "@/lib/billing";

const PENDING_CHECKOUT_KEY = "sundera:pendingCheckout";
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 6; // ~12s of polling after returning from checkout

// Call right before redirecting to lava.top so useTokenBalance knows to
// poll for a balance increase on the way back (the webhook can land late).
export function markCheckoutPending() {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(PENDING_CHECKOUT_KEY, "1");
  }
}

export function useTokenBalance() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<TokensResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const balanceRef = useRef<number | null>(null);

  const refetch = useCallback(async () => {
    if (!user) {
      setTokens(null);
      balanceRef.current = null;
      return null;
    }
    const result = await getMyTokens();
    setTokens(result);
    balanceRef.current = result.balance;
    return result;
  }, [user]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(PENDING_CHECKOUT_KEY) !== "1") return;

    const balanceBeforeCheckout = balanceRef.current;
    let cancelled = false;
    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    setIsProcessing(true);

    const stop = () => {
      window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
      if (!cancelled) setIsProcessing(false);
    };

    const poll = async () => {
      attempts += 1;
      const result = await refetch();
      if (cancelled) return;
      const increased =
        result &&
        (balanceBeforeCheckout === null ||
          result.balance > balanceBeforeCheckout);
      if (increased || attempts >= MAX_POLL_ATTEMPTS) {
        stop();
        return;
      }
      timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [user, refetch]);

  return { tokens, isProcessing, refetch };
}
