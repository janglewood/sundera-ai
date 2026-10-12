import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DESIGN_STYLE_LABELS, ROOM_TYPE_LABELS } from "@sundera/shared";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { listBlogPosts, formatPostDate } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog — Sundera AI Interior Design",
  description:
    "Before-and-after AI room redesigns, with real breakdowns of palette, materials, and what it would cost to recreate in real life.",
  alternates: { canonical: "/blog" },
};

// Content is DB-backed and the Docker build stage has no network path to a
// live apps/api — a static/ISR page would try (and fail) to fetch at build
// time. force-dynamic renders per-request instead; cheap at today's traffic.
export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
  const posts = await listBlogPosts();

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="flex-1 px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
              Redesign ideas, before &amp; after
            </h1>
            <p className="mt-4 text-muted-foreground">
              Real rooms, reimagined by Sundera&rsquo;s AI — with the palette,
              materials, and rough real-world cost behind every transformation.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group overflow-hidden rounded-3xl border border-white/40 bg-card/40 shadow-lg shadow-black/5 backdrop-blur-xl transition-shadow hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                <div className="relative aspect-3/4 w-full overflow-hidden">
                  <Image
                    src={post.imageUrl}
                    alt={post.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2 text-xs font-semibold tracking-wide text-accent-hover uppercase">
                    <span>{ROOM_TYPE_LABELS[post.roomType]}</span>
                    <span aria-hidden>&middot;</span>
                    <span>{DESIGN_STYLE_LABELS[post.style]}</span>
                  </div>
                  <h2 className="mt-2 font-display text-lg leading-snug tracking-tight">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{post.dek}</p>
                  <time
                    dateTime={post.publishedAt}
                    className="mt-3 block text-xs text-muted-foreground"
                  >
                    {formatPostDate(post.publishedAt)}
                  </time>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
