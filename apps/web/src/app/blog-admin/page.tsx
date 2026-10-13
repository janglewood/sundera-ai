import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DESIGN_STYLE_LABELS, ROOM_TYPE_LABELS } from "@sundera/shared";
import { getBlogQueue } from "@/lib/blog-admin";
import { logout, publishQueuedPost } from "./actions";
import { ConfirmSubmitForm } from "./ConfirmSubmitForm";

export const metadata: Metadata = {
  title: "Blog admin queue — Sundera AI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function formatScheduledFor(iso: string): string {
  return `${new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  })} UTC`;
}

export default async function BlogAdminQueuePage() {
  const queue = await getBlogQueue();

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl tracking-tight">Queued blog posts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {queue.length} waiting for their scheduled slot.
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-full border border-foreground/15 px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/40"
            >
              Log out
            </button>
          </form>
        </div>

        {queue.length === 0 ? (
          <p className="mt-12 text-sm text-muted-foreground">
            Nothing in the queue right now — check back once marketing/blog&rsquo;s bot
            approves a new article.
          </p>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {queue.map((post) => (
              <li
                key={post.slug}
                className="overflow-hidden rounded-3xl border border-foreground/10 bg-card/40 shadow-lg shadow-black/5"
              >
                <Link href={`/blog-admin/${post.slug}`} className="block">
                  <div className="relative aspect-3/4 w-full overflow-hidden">
                    <Image
                      src={post.imageUrl}
                      alt={post.imageAlt}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold tracking-wide text-accent-hover uppercase">
                      <span>{ROOM_TYPE_LABELS[post.roomType]}</span>
                      <span aria-hidden>&middot;</span>
                      <span>{DESIGN_STYLE_LABELS[post.style]}</span>
                    </div>
                    <h2 className="mt-2 font-display text-lg leading-snug tracking-tight">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">{post.dek}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Scheduled for {formatScheduledFor(post.scheduledFor)}
                    </p>
                  </div>
                </Link>
                <div className="flex gap-2 border-t border-foreground/10 p-4">
                  <Link
                    href={`/blog-admin/${post.slug}`}
                    className="flex-1 rounded-full border border-foreground/15 px-4 py-2 text-center text-sm font-medium transition-colors hover:border-foreground/40"
                  >
                    Edit
                  </Link>
                  <ConfirmSubmitForm
                    action={publishQueuedPost.bind(null, post.slug)}
                    confirmMessage={`Publish "${post.title}" now? It'll go live immediately and leave the queue.`}
                    className="flex-1"
                  >
                    <button
                      type="submit"
                      className="w-full rounded-full bg-accent bg-linear-to-br from-accent to-accent-hover px-4 py-2 text-sm font-semibold text-accent-foreground shadow-md shadow-accent/30 transition-colors hover:bg-accent-hover"
                    >
                      Publish
                    </button>
                  </ConfirmSubmitForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
