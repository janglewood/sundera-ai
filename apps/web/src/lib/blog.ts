import type { BlogPostDetail, BlogPostSummary } from "@sundera/shared";
import { apiGet, ApiError } from "./api-client";

export function listBlogPosts(): Promise<BlogPostSummary[]> {
  return apiGet<BlogPostSummary[]>("/blog-posts");
}

export async function getBlogPost(slug: string): Promise<BlogPostDetail | null> {
  try {
    return await apiGet<BlogPostDetail>(`/blog-posts/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function getRelatedBlogPosts(
  posts: BlogPostSummary[],
  current: BlogPostSummary,
  limit = 4,
): BlogPostSummary[] {
  const others = posts.filter((post) => post.slug !== current.slug);
  const sameRoom = others.filter((post) => post.roomType === current.roomType);
  const rest = others.filter((post) => post.roomType !== current.roomType);
  return [...sameRoom, ...rest].slice(0, limit);
}

export function formatPostDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
