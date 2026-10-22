"use client";

import type { GenerationSummary } from "@sundera/shared";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { listMyGenerations } from "@/lib/generations";

function GenerationRow({
  generation,
  onNavigate,
}: {
  generation: GenerationSummary;
  onNavigate: () => void;
}) {
  const t = useTranslations("AppSidebar");
  const tRoomType = useTranslations("RoomTypes");
  const tDesignStyle = useTranslations("DesignStyles");
  const locale = useLocale();

  const statusLabels: Record<GenerationSummary["status"], string> = {
    PENDING: t("statusPending"),
    PROCESSING: t("statusProcessing"),
    COMPLETED: t("statusCompleted"),
    FAILED: t("statusFailed"),
  };

  return (
    <Link
      href={`/generations/${generation.id}`}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-foreground/5"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={generation.thumbnailUrl}
        alt=""
        className="h-12 w-12 shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {generation.title ??
            `${tRoomType(generation.roomType)} · ${tDesignStyle(generation.style)}`}
        </p>
        <p className="text-xs text-foreground/60">
          {generation.status === "COMPLETED"
            ? new Date(generation.createdAt).toLocaleDateString(locale)
            : statusLabels[generation.status]}
        </p>
      </div>
    </Link>
  );
}

interface AppSidebarProps {
  open: boolean;
  onClose: () => void;
  onEmptyChange?: (empty: boolean) => void;
}

export function AppSidebar({ open, onClose, onEmptyChange }: AppSidebarProps) {
  const t = useTranslations("AppSidebar");
  const [generations, setGenerations] = useState<GenerationSummary[] | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    listMyGenerations()
      .then((result) => {
        if (!cancelled) setGenerations(result);
      })
      .catch(() => {
        if (!cancelled) setGenerations([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (generations !== null) {
      onEmptyChange?.(generations.length === 0);
    }
  }, [generations, onEmptyChange]);

  if (generations === null || generations.length === 0) {
    return null;
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex h-screen w-72 shrink-0 flex-col border-r border-foreground/10 bg-background p-4 transition-transform duration-200 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex-1 overflow-y-auto">
          <h2 className="mb-2 px-2 text-xs font-semibold tracking-wide text-foreground/50 uppercase">
            {t("yourRedesigns")}
          </h2>
          <div className="flex flex-col gap-1">
            {generations.map((generation) => (
              <GenerationRow
                key={generation.id}
                generation={generation}
                onNavigate={onClose}
              />
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
