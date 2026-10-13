import "server-only";
import type { BlogPostAdminDetail, BlogPostQueueItem, UpdateBlogPostRequest } from "@sundera/shared";
import { apiUrl } from "./api-client";

// Server-only client for apps/api's /blog-posts/admin/* routes. Never import
// this from a client component: it sends BLOG_BOT_API_SECRET, which must
// match apps/api's BLOG_BOT_API_SECRET (the same shared secret
// marketing/blog/'s Telegram bot uses — see BlogBotGuard) and grants
// read/edit/publish access to every unpublished post.
function adminHeaders(): Record<string, string> {
  const secret = process.env.BLOG_BOT_API_SECRET;
  if (!secret) {
    throw new Error("BLOG_BOT_API_SECRET is not configured for apps/web");
  }
  return { "X-Blog-Bot-Secret": secret };
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: { ...adminHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`apps/api ${path} failed (${response.status}): ${body}`);
  }
  return response.json() as Promise<T>;
}

export function getBlogQueue(): Promise<BlogPostQueueItem[]> {
  return adminFetch<BlogPostQueueItem[]>("/blog-posts/admin/queue");
}

export async function getAdminBlogPost(slug: string): Promise<BlogPostAdminDetail | null> {
  try {
    return await adminFetch<BlogPostAdminDetail>(`/blog-posts/admin/${slug}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("(404)")) return null;
    throw err;
  }
}

export function updateBlogPost(
  slug: string,
  dto: UpdateBlogPostRequest,
): Promise<BlogPostAdminDetail> {
  return adminFetch<BlogPostAdminDetail>(`/blog-posts/admin/${slug}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
}

export function publishBlogPost(slug: string): Promise<BlogPostAdminDetail> {
  return adminFetch<BlogPostAdminDetail>(`/blog-posts/admin/${slug}/publish`, {
    method: "POST",
  });
}

// 204 No Content on success — can't reuse adminFetch<T>, which always parses
// a JSON body.
export async function deleteBlogPost(slug: string): Promise<void> {
  const path = `/blog-posts/admin/${slug}`;
  const response = await fetch(apiUrl(path), {
    method: "DELETE",
    headers: adminHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`apps/api ${path} failed (${response.status}): ${body}`);
  }
}
