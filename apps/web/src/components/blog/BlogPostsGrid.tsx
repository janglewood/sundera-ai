"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DESIGN_STYLE_LABELS, ROOM_TYPE_LABELS } from "@sundera/shared";
import type { BlogPostSummary } from "@sundera/shared";
import { listBlogPosts, formatPostDate } from "@/lib/blog";

export const BLOG_INITIAL_PAGE_SIZE = 24;
const PAGE_SIZE = 15;

interface BlogPostsGridProps {
  initialPosts: BlogPostSummary[];
}

export function BlogPostsGrid({ initialPosts }: BlogPostsGridProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialPosts.length >= BLOG_INITIAL_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listBlogPosts({ offset: posts.length, limit: PAGE_SIZE });
      setPosts((prev) => [...prev, ...next]);
      if (next.length < PAGE_SIZE) setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [posts.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading) loadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <>
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

      {hasMore && (
        <div ref={sentinelRef} className="mt-12 flex justify-center">
          {loading && (
            <span className="text-sm text-muted-foreground">Loading more&hellip;</span>
          )}
        </div>
      )}
    </>
  );
}
