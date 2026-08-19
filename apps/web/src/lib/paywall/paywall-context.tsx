"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { PaywallModal } from "@/components/paywall/PaywallModal";

export type PaywallReason = "limit" | "browse";

interface PaywallContextValue {
  openPaywall: (reason?: PaywallReason) => void;
  closePaywall: () => void;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<PaywallReason>("browse");

  return (
    <PaywallContext.Provider
      value={{
        openPaywall: (nextReason = "browse") => {
          setReason(nextReason);
          setIsOpen(true);
        },
        closePaywall: () => setIsOpen(false),
      }}
    >
      {children}
      <PaywallModal
        isOpen={isOpen}
        reason={reason}
        onClose={() => setIsOpen(false)}
      />
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  const ctx = useContext(PaywallContext);
  if (!ctx) {
    throw new Error("usePaywall must be used within a PaywallProvider");
  }
  return ctx;
}
