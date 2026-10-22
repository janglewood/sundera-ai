"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { getLockedStylesForPlanTier } from "@sundera/shared";
import type { DesignStyle, RoomType } from "@sundera/shared";
import { RoomTypeGrid } from "@/components/select/RoomTypeGrid";
import { StyleGrid } from "@/components/select/StyleGrid";
import { VoiceTextarea } from "@/components/shared/VoiceTextarea";
import { AuthGateModal } from "@/components/auth/AuthGateModal";
import { ApiError } from "@/lib/api-client";
import { createGeneration } from "@/lib/generations";
import { useAuth } from "@/lib/auth/auth-context";
import { usePaywall } from "@/lib/paywall/paywall-context";
import { useTokenBalance } from "@/lib/useTokenBalance";
import { track } from "@/lib/analytics/posthog";

function NewGenerationForm() {
  const t = useTranslations("New");
  const router = useRouter();
  const searchParams = useSearchParams();
  const photoId = searchParams.get("photoId");
  const { user, loading } = useAuth();
  const { openPaywall } = usePaywall();
  const { tokens, refetch: refetchTokens } = useTokenBalance();

  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [style, setStyle] = useState<DesignStyle | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const generateStepRef = useRef<HTMLDivElement | null>(null);

  const lockedStyles = getLockedStylesForPlanTier(tokens?.planTier ?? "FREE");
  const tokensBalance = tokens?.balance ?? 0;

  useEffect(() => {
    if (!roomType || !style) return;
    const frame = requestAnimationFrame(() => {
      generateStepRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [roomType, style]);

  if (!photoId) {
    return (
      <div className="text-center text-foreground/60">
        {t("missingPhotoPrefix")}{" "}
        <Link href="/" className="underline">
          {t("uploadRoomPhoto")}
        </Link>{" "}
        {t("missingPhotoSuffix")}
      </div>
    );
  }

  if (loading) {
    return null;
  }

  async function startGeneration() {
    if (!photoId || !roomType || !style) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const generation = await createGeneration({
        roomPhotoId: photoId,
        roomType,
        style,
        customPrompt: customPrompt.trim() || undefined,
      });
      track("generation_started", {
        generationId: generation.id,
        roomType,
        style,
        hasCustomPrompt: customPrompt.trim().length > 0,
      });
      router.push(`/generations/${generation.id}`);
      void refetchTokens();
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        openPaywall("limit");
      } else {
        setError(
          err instanceof Error ? err.message : t("failedToStart"),
        );
      }
      setIsSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!photoId || !roomType || !style) return;
    if (!user) {
      setShowAuthGate(true);
      return;
    }
    if (tokensBalance < 1) {
      openPaywall("limit");
      return;
    }
    await startGeneration();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-16">
      <button
        type="button"
        onClick={() => router.push("/app")}
        className="flex items-center gap-1 self-start text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        {t("back")}
      </button>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{t("whatRoom")}</h2>
        <RoomTypeGrid
          value={roomType}
          onChange={(nextRoomType) => {
            setRoomType(nextRoomType);
            setStyle(null);
          }}
        />
      </section>

      {roomType && (
        <section className="wizard-step-enter">
          <h2 className="mb-4 text-lg font-semibold">{t("pickStyle")}</h2>
          <StyleGrid
            value={style}
            onChange={setStyle}
            lockedStyles={lockedStyles}
            onLockedSelect={() => openPaywall("style")}
          />
        </section>
      )}

      {roomType && style && (
        <div
          ref={generateStepRef}
          className="wizard-step-enter flex flex-col gap-10"
        >
          <section>
            <label className="mb-2 block text-sm font-medium">
              {t("anythingElse")}
            </label>
            <VoiceTextarea
              value={customPrompt}
              onChange={setCustomPrompt}
              placeholder={t("promptPlaceholder")}
              rows={3}
            />
          </section>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              disabled={isSubmitting || (!!user && tokensBalance < 1)}
              onClick={() => void handleSubmit()}
              className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity disabled:opacity-40"
            >
              {isSubmitting ? t("starting") : t("generateCta")}
            </button>
            {user && (
              <p className="text-xs text-foreground/60">
                {t("tokensLeft", { count: tokensBalance })}
              </p>
            )}
          </div>
        </div>
      )}

      {showAuthGate && (
        <AuthGateModal
          reason="generate"
          onClose={() => setShowAuthGate(false)}
          onSuccess={() => {
            setShowAuthGate(false);
            void startGeneration();
          }}
        />
      )}
    </div>
  );
}

export default function NewGenerationPage() {
  return (
    <Suspense>
      <NewGenerationForm />
    </Suspense>
  );
}
