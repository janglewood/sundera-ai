"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUUpLeft, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { ROOM_TYPE_LABELS, DESIGN_STYLE_LABELS } from "@sundera/shared";
import type { RoomType, DesignStyle, RegionMask } from "@sundera/shared";
import { usePollGeneration } from "@/lib/use-poll-generation";
import {
  createGenerationEdit,
  downloadGenerationResult,
  renameGeneration,
} from "@/lib/generations";
import { ApiError } from "@/lib/api-client";
import { usePaywall } from "@/lib/paywall/paywall-context";
import { useAuth } from "@/lib/auth/auth-context";
import { rememberAnonGeneration } from "@/lib/anon-generations";
import {
  AuthGateModal,
  type AuthGateReason,
} from "@/components/auth/AuthGateModal";
import { VoiceTextarea } from "@/components/shared/VoiceTextarea";
import { GenerationProgress } from "./GenerationProgress";
import { RegionMaskEditor } from "./RegionMaskEditor";

interface GenerationViewProps {
  id: string;
}

function extensionFromUrl(url: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(url);
  return match ? match[1] : "jpg";
}

function BackLink() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <Link
      href="/app"
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
      My projects
    </Link>
  );
}

function HeaderActions({ onSignUp }: { onSignUp: () => void }) {
  const { user } = useAuth();

  return (
    <div className="flex items-center justify-between">
      <BackLink />
      {user ? (
        <Link
          href="/app"
          className="rounded-full border border-foreground/20 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/5"
        >
          Start over
        </Link>
      ) : (
        <button
          type="button"
          onClick={onSignUp}
          className="ml-auto rounded-full border border-foreground/20 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-foreground/5"
        >
          Sign up
        </button>
      )}
    </div>
  );
}

export function GenerationView({ id }: GenerationViewProps) {
  const router = useRouter();
  const { openPaywall } = usePaywall();
  const { user } = useAuth();
  const { generation, error } = usePollGeneration(id);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [isDrawingRegion, setIsDrawingRegion] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [authGate, setAuthGate] = useState<AuthGateReason | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "edit" | "regionEdit" | "rename" | "download" | "drawMode" | null
  >(null);
  const [drawModeSignal, setDrawModeSignal] = useState(0);
  const [pendingRegionEdit, setPendingRegionEdit] = useState<{
    regionMask: RegionMask;
    prompt: string;
  } | null>(null);

  useEffect(() => {
    if (!user) rememberAnonGeneration(id);
  }, [user, id]);

  if (error) {
    return (
      <>
        <BackLink />
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-red-500">{error}</p>
          <Link href="/app" className="underline">
            Start over
          </Link>
        </div>
      </>
    );
  }

  if (!generation) {
    return <GenerationProgress status="PENDING" />;
  }

  if (generation.status === "PENDING" || generation.status === "PROCESSING") {
    return <GenerationProgress status={generation.status} />;
  }

  if (generation.status === "FAILED") {
    return (
      <>
        <BackLink />
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-lg font-medium">Generation failed</p>
          <p className="text-sm text-foreground/60">
            {generation.errorMessage ??
              "Something went wrong. Please try again."}
          </p>
          <Link href="/" className="underline">
            Try again
          </Link>
        </div>
      </>
    );
  }

  const results = generation.resultImages ?? [];
  const activeResult = results[selectedVariant] ?? results[0];
  const defaultTitle = `${ROOM_TYPE_LABELS[generation.roomType as RoomType]} in ${DESIGN_STYLE_LABELS[generation.style as DesignStyle]} style`;
  const displayTitle = titleOverride ?? generation.title ?? defaultTitle;

  async function performEditSubmit() {
    if (!activeResult || !editPrompt.trim()) return;
    setIsEditSubmitting(true);
    setEditError(null);
    try {
      const edit = await createGenerationEdit(id, {
        sourceResultId: activeResult.id,
        prompt: editPrompt.trim(),
      });
      router.push(`/generations/${edit.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthGate("edit");
      } else if (err instanceof ApiError && err.status === 402) {
        openPaywall("limit");
      } else {
        setEditError(
          err instanceof Error ? err.message : "Failed to start edit",
        );
      }
      setIsEditSubmitting(false);
    }
  }

  async function handleEditSubmit() {
    if (!user) {
      setPendingAction("edit");
      setAuthGate("edit");
      return;
    }
    await performEditSubmit();
  }

  async function performRegionEditSubmit(regionMask: RegionMask, prompt: string) {
    if (!activeResult) return;
    setIsEditSubmitting(true);
    setEditError(null);
    try {
      const edit = await createGenerationEdit(id, {
        sourceResultId: activeResult.id,
        prompt,
        regionMask,
      });
      router.push(`/generations/${edit.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthGate("edit");
      } else if (err instanceof ApiError && err.status === 402) {
        openPaywall("limit");
      } else {
        setEditError(
          err instanceof Error ? err.message : "Failed to start edit",
        );
      }
      setIsEditSubmitting(false);
    }
  }

  async function handleRegionEditSubmit(regionMask: RegionMask, prompt: string) {
    if (!user) {
      setPendingRegionEdit({ regionMask, prompt });
      setPendingAction("regionEdit");
      setAuthGate("edit");
      return;
    }
    await performRegionEditSubmit(regionMask, prompt);
  }

  function performStartEditingTitle() {
    setTitleDraft(displayTitle);
    setIsEditingTitle(true);
  }

  function startEditingTitle() {
    if (!user) {
      setPendingAction("rename");
      setAuthGate("edit");
      return;
    }
    performStartEditingTitle();
  }

  async function handleRenameSubmit() {
    const trimmed = titleDraft.trim();
    if (!trimmed || isSavingTitle) return;
    setIsSavingTitle(true);
    try {
      const updated = await renameGeneration(id, { title: trimmed });
      setTitleOverride(updated.title);
      setIsEditingTitle(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setIsEditingTitle(false);
        setAuthGate("edit");
      }
      // otherwise leave the editor open so the user can retry
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function performDownload() {
    if (!activeResult) return;
    setIsDownloading(true);
    try {
      const blob = await downloadGenerationResult(id, activeResult.id);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `sundera-redesign-${activeResult.index + 1}.${extensionFromUrl(activeResult.url)}`;
      link.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthGate("download");
      } else if (err instanceof ApiError && err.status === 402) {
        openPaywall("limit");
      }
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDownload() {
    if (!user) {
      setPendingAction("download");
      setAuthGate("download");
      return;
    }
    await performDownload();
  }

  return (
    <>
      <HeaderActions onSignUp={() => setAuthGate("account")} />
      <div className="flex flex-col gap-6">
        <div className="text-center">
          {isEditingTitle ? (
            <div className="mx-auto flex max-w-md items-center justify-center gap-2">
              <input
                autoFocus
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleRenameSubmit();
                  if (e.key === "Escape") setIsEditingTitle(false);
                }}
                maxLength={80}
                className="w-full rounded-lg border border-foreground/20 bg-transparent px-3 py-1.5 text-center text-2xl font-semibold outline-none focus:border-foreground/40"
              />
              <button
                type="button"
                disabled={!titleDraft.trim() || isSavingTitle}
                onClick={() => void handleRenameSubmit()}
                className="shrink-0 rounded-full bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
              >
                {isSavingTitle ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <h1 className="group flex items-center justify-center gap-2 text-2xl font-semibold">
              {displayTitle}
              <button
                type="button"
                onClick={startEditingTitle}
                aria-label="Rename"
                className="text-foreground/40 transition-colors hover:text-foreground"
              >
                <PencilSimple size={16} weight="bold" />
              </button>
            </h1>
          )}
          {generation.isEdit && generation.customPrompt && (
            <div className="mt-1 flex items-center justify-center gap-2">
              <p className="text-sm text-foreground/60">
                Edited: {generation.customPrompt}
              </p>
              {generation.parentGenerationId && (
                <Link
                  href={`/generations/${generation.parentGenerationId}`}
                  className="flex shrink-0 items-center gap-1 text-sm font-semibold text-foreground underline underline-offset-2 transition-opacity hover:opacity-70"
                >
                  <ArrowUUpLeft size={14} weight="bold" />
                  Undo
                </Link>
              )}
            </div>
          )}
        </div>

        {activeResult && (
          <RegionMaskEditor
            beforeUrl={generation.sourceImageUrl}
            afterUrl={activeResult.url}
            onApply={(regionMask, prompt) =>
              void handleRegionEditSubmit(regionMask, prompt)
            }
            isSubmitting={isEditSubmitting}
            error={editError}
            onDrawModeChange={setIsDrawingRegion}
            onDownload={() => void handleDownload()}
            isDownloading={isDownloading}
            canEdit={!!user}
            onRequestSignUp={() => {
              setPendingAction("drawMode");
              setAuthGate("edit");
            }}
            autoEnterDrawModeSignal={drawModeSignal}
          />
        )}

        {results.length > 1 && (
          <div className="flex justify-center gap-3">
            {results.map((result) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={result.index}
                src={result.url}
                alt={`Variant ${result.index + 1}`}
                onClick={() => setSelectedVariant(result.index)}
                className={`h-16 w-16 cursor-pointer rounded-lg object-cover ring-2 transition-opacity ${
                  result.index === selectedVariant
                    ? "ring-foreground"
                    : "ring-transparent opacity-60"
                }`}
              />
            ))}
          </div>
        )}

        {activeResult && !isDrawingRegion && (
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">
              Want to tweak this result?
            </label>
            <VoiceTextarea
              value={editPrompt}
              onChange={setEditPrompt}
              placeholder="e.g. change the sofa to leather"
              rows={3}
            />
            {editError && <p className="text-sm text-red-500">{editError}</p>}
            <button
              type="button"
              disabled={!editPrompt.trim() || isEditSubmitting}
              onClick={() => void handleEditSubmit()}
              className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity disabled:opacity-40"
            >
              {isEditSubmitting ? "Starting…" : "Edit"}
            </button>
          </div>
        )}
      </div>

      {authGate && (
        <AuthGateModal
          reason={authGate}
          onClose={() => {
            setAuthGate(null);
            setPendingAction(null);
            setPendingRegionEdit(null);
          }}
          onSuccess={() => {
            const action = pendingAction;
            const regionEdit = pendingRegionEdit;
            setAuthGate(null);
            setPendingAction(null);
            setPendingRegionEdit(null);
            if (action === "download") {
              void performDownload();
            } else if (action === "edit") {
              void performEditSubmit();
            } else if (action === "regionEdit" && regionEdit) {
              void performRegionEditSubmit(regionEdit.regionMask, regionEdit.prompt);
            } else if (action === "rename") {
              performStartEditingTitle();
            } else if (action === "drawMode") {
              setDrawModeSignal((n) => n + 1);
            }
          }}
        />
      )}
    </>
  );
}
