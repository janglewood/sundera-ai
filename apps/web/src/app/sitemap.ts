import type { MetadataRoute } from "next";
import { listBlogPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/site";

// See app/blog/page.tsx — force-dynamic, not ISR: the Docker build stage has
// no network path to a live apps/api to fetch posts from at build time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listBlogPosts();
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.8 },
    ...posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.publishedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
