import type { Metadata } from "next";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { BlogPostsGrid, BLOG_INITIAL_PAGE_SIZE } from "@/components/blog/BlogPostsGrid";
import { listBlogPosts } from "@/lib/blog";

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
  const posts = await listBlogPosts({ limit: BLOG_INITIAL_PAGE_SIZE });

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

          <BlogPostsGrid initialPosts={posts} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
