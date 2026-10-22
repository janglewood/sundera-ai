"use client";

import { useTranslations } from "next-intl";

interface GenerationProgressProps {
  status: "PENDING" | "PROCESSING";
}

export function GenerationProgress({ status }: GenerationProgressProps) {
  const t = useTranslations("GenerationProgress");
  const label = status === "PENDING" ? t("queued") : t("processing");

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
      <p className="text-lg font-medium">{label}</p>
      <p className="text-sm text-foreground/60">{t("usuallyTakes")}</p>
    </div>
  );
}
