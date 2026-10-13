"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BlogFaqItem, BlogPostAdminDetail, BlogPriceRow } from "@sundera/shared";
import { BlogArticleBody } from "@/components/blog/BlogArticleBody";
import { LocalDateTime } from "@/components/blog/LocalDateTime";
import { deleteQueuedPost, publishQueuedPost, saveBlogDraft } from "../actions";

interface BlogAdminEditorProps {
  post: BlogPostAdminDetail;
  roomLabel: string;
  styleLabel: string;
}

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-background px-3.5 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-60";

export function BlogAdminEditor({ post, roomLabel, styleLabel }: BlogAdminEditorProps) {
  const router = useRouter();
  const editable = post.status === "SCHEDULED";

  const [title, setTitle] = useState(post.title);
  const [dek, setDek] = useState(post.dek);
  const [imageAlt, setImageAlt] = useState(post.imageAlt);
  const [palette, setPalette] = useState(post.palette);
  const [materials, setMaterials] = useState(post.materials);
  const [lighting, setLighting] = useState(post.lighting);
  const [problemsText, setProblemsText] = useState(post.problems.join("\n"));
  const [priceTable, setPriceTable] = useState<BlogPriceRow[]>(post.priceTable);
  const [faq, setFaq] = useState<BlogFaqItem[]>(post.faq);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Collapsing the editor is purely a local view preference — lets the
  // preview take the full width to read a draft like a real page, without
  // touching any saved data.
  const [formCollapsed, setFormCollapsed] = useState(false);

  const busy = saving || publishing || deleting;

  const problems = problemsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  function buildPayload() {
    return { title, dek, imageAlt, problems, palette, materials, lighting, priceTable, faq };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      await saveBlogDraft(post.slug, buildPayload());
      setJustSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (
      !window.confirm(
        `Publish "${title}" now? It'll go live immediately and leave the queue.`,
      )
    ) {
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      await saveBlogDraft(post.slug, buildPayload());
      await publishQueuedPost(post.slug); // redirects to /blog-admin on success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish.");
      setPublishing(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${title}" from the queue? This can't be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteQueuedPost(post.slug); // redirects to /blog-admin on success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
      setDeleting(false);
    }
  }

  function updatePriceRow(index: number, field: keyof BlogPriceRow, value: string) {
    setPriceTable((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }
  function addPriceRow() {
    setPriceTable((rows) => [...rows, { item: "", budget: "", mid: "" }]);
  }
  function removePriceRow(index: number) {
    setPriceTable((rows) => rows.filter((_, i) => i !== index));
  }

  function updateFaqItem(index: number, field: keyof BlogFaqItem, value: string) {
    setFaq((items) => items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }
  function addFaqItem() {
    setFaq((items) => [...items, { question: "", answer: "" }]);
  }
  function removeFaqItem(index: number) {
    setFaq((items) => items.filter((_, i) => i !== index));
  }

  const previewPost = {
    title,
    dek,
    imageUrl: post.imageUrl,
    imageAlt,
    problems,
    palette,
    materials,
    lighting,
    priceTable,
    faq,
  };

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-foreground/10 bg-background/90 px-6 py-4 backdrop-blur-xl sm:px-8">
        <div>
          <button
            type="button"
            onClick={() => router.push("/blog-admin")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back to queue
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            {editable ? (
              <>
                Scheduled for <LocalDateTime iso={post.scheduledFor} />
              </>
            ) : (
              "Already published — read-only."
            )}
          </p>
        </div>
        {editable && (
          <div className="flex items-center gap-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            {!error && justSaved && <p className="text-sm text-muted-foreground">Saved.</p>}
            <button
              type="button"
              onClick={() => setFormCollapsed((collapsed) => !collapsed)}
              className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/40"
            >
              {formCollapsed ? "Show editor" : "Collapse editor"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-full border border-red-600/30 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-600/60 hover:bg-red-600/5 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/40 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={busy}
              className="rounded-full bg-accent bg-linear-to-br from-accent to-accent-hover px-5 py-2 text-sm font-semibold text-accent-foreground shadow-md shadow-accent/30 transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {publishing ? "Publishing…" : "Publish now"}
            </button>
          </div>
        )}
      </div>

      <div
        className={`grid flex-1 gap-8 px-6 py-8 sm:px-8 ${formCollapsed ? "" : "lg:grid-cols-2"}`}
      >
        {!formCollapsed && (
          <div className="space-y-6">
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!editable}
                className={inputClass}
              />
            </Field>
            <Field label="Dek">
              <textarea
                value={dek}
                onChange={(e) => setDek(e.target.value)}
                disabled={!editable}
                rows={2}
                className={inputClass}
              />
            </Field>
            <Field label="Image alt text">
              <input
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                disabled={!editable}
                className={inputClass}
              />
            </Field>
            <Field label="What wasn't working (one per line)">
              <textarea
                value={problemsText}
                onChange={(e) => setProblemsText(e.target.value)}
                disabled={!editable}
                rows={4}
                className={inputClass}
              />
            </Field>
            <Field label="Palette">
              <textarea
                value={palette}
                onChange={(e) => setPalette(e.target.value)}
                disabled={!editable}
                rows={2}
                className={inputClass}
              />
            </Field>
            <Field label="Materials">
              <textarea
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
                disabled={!editable}
                rows={2}
                className={inputClass}
              />
            </Field>
            <Field label="Lighting">
              <textarea
                value={lighting}
                onChange={(e) => setLighting(e.target.value)}
                disabled={!editable}
                rows={2}
                className={inputClass}
              />
            </Field>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">Price table</label>
                {editable && (
                  <button
                    type="button"
                    onClick={addPriceRow}
                    className="text-xs font-medium text-accent-hover hover:underline"
                  >
                    + Add row
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {priceTable.map((row, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      value={row.item}
                      onChange={(e) => updatePriceRow(index, "item", e.target.value)}
                      disabled={!editable}
                      placeholder="Item"
                      className={inputClass}
                    />
                    <input
                      value={row.budget}
                      onChange={(e) => updatePriceRow(index, "budget", e.target.value)}
                      disabled={!editable}
                      placeholder="Budget"
                      className={inputClass}
                    />
                    <input
                      value={row.mid}
                      onChange={(e) => updatePriceRow(index, "mid", e.target.value)}
                      disabled={!editable}
                      placeholder="Mid-range"
                      className={inputClass}
                    />
                    {editable && (
                      <button
                        type="button"
                        onClick={() => removePriceRow(index)}
                        className="shrink-0 text-xs text-muted-foreground hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">FAQ</label>
                {editable && (
                  <button
                    type="button"
                    onClick={addFaqItem}
                    className="text-xs font-medium text-accent-hover hover:underline"
                  >
                    + Add question
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-3">
                {faq.map((item, index) => (
                  <div key={index} className="space-y-1.5 rounded-xl border border-foreground/10 p-3">
                    <input
                      value={item.question}
                      onChange={(e) => updateFaqItem(index, "question", e.target.value)}
                      disabled={!editable}
                      placeholder="Question"
                      className={inputClass}
                    />
                    <textarea
                      value={item.answer}
                      onChange={(e) => updateFaqItem(index, "answer", e.target.value)}
                      disabled={!editable}
                      rows={2}
                      placeholder="Answer"
                      className={inputClass}
                    />
                    {editable && (
                      <button
                        type="button"
                        onClick={() => removeFaqItem(index)}
                        className="text-xs text-muted-foreground hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className={formCollapsed ? "" : "lg:sticky lg:top-24 lg:self-start"}>
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Live preview — exactly what goes live on publish
          </p>
          <div className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-3xl border border-foreground/10 bg-card/20 px-6 py-10">
            <BlogArticleBody
              post={previewPost}
              slug={post.slug}
              roomLabel={roomLabel}
              styleLabel={styleLabel}
              dateLabel={
                editable ? (
                  <>
                    Scheduled for <LocalDateTime iso={post.scheduledFor} />
                  </>
                ) : post.publishedAt ? (
                  <>
                    Published <LocalDateTime iso={post.publishedAt} />
                  </>
                ) : (
                  ""
                )
              }
              dateValue={post.publishedAt ?? undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
