"use client";

import { X } from "@phosphor-icons/react/dist/ssr";
import type { UserCredential } from "firebase/auth";
import { useTranslations } from "next-intl";
import { AuthForm } from "./AuthForm";

export type AuthGateReason = "generate" | "edit" | "download" | "account";

interface AuthGateModalProps {
  reason: AuthGateReason;
  onClose: () => void;
  onSuccess: (credential: UserCredential) => void;
}

export function AuthGateModal({ reason, onClose, onSuccess }: AuthGateModalProps) {
  const t = useTranslations("AuthGate");
  const title = t(`${reason}Title` as "generateTitle");
  const subtitle = t(`${reason}Subtitle` as "generateSubtitle");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:overflow-y-auto sm:p-4 sm:py-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-y-auto bg-card p-6 sm:h-auto sm:max-h-[90vh] sm:max-w-sm sm:rounded-3xl sm:border sm:border-white/40 sm:p-10 sm:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="sticky top-0 z-10 -mt-1 -mr-1 self-end rounded-full bg-card/90 p-1.5 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted hover:text-foreground sm:absolute sm:top-4 sm:right-4 sm:m-0 sm:self-auto sm:bg-transparent sm:p-1.5 sm:shadow-none sm:backdrop-blur-none"
        >
          <X size={18} weight="bold" className="sm:size-5" />
        </button>

        <div className="mt-8 flex flex-1 items-center justify-center sm:mt-0">
          <AuthForm title={title} subtitle={subtitle} onSuccess={onSuccess} />
        </div>
      </div>
    </div>
  );
}
