"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { UpdateBlogPostRequest } from "@sundera/shared";
import {
  constantTimeEqual,
  isValidSessionCookie,
  sha256Hex,
  SESSION_COOKIE,
} from "@/lib/blog-admin-auth";
import { deleteBlogPost, publishBlogPost, updateBlogPost } from "@/lib/blog-admin";

// Server Functions aren't separate routes proxy.ts can reliably gate forever
// — Next's own docs warn a matcher change can silently drop coverage for an
// action without anyone noticing. proxy.ts is still the primary gate (it
// also protects page renders, which this can't), but every mutating action
// re-checks the session itself so a future routing refactor can't quietly
// turn these into unauthenticated writes.
async function requireAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const valid = await isValidSessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  if (!valid) {
    throw new Error("Not authenticated.");
  }
}

export async function login(
  _prevState: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.BLOG_ADMIN_PASSWORD;
  if (!expected) {
    return { error: "BLOG_ADMIN_PASSWORD is not configured on the server." };
  }
  if (!constantTimeEqual(password, expected)) {
    return { error: "Incorrect password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await sha256Hex(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  const from = String(formData.get("from") ?? "");
  redirect(from.startsWith("/blog-admin") ? from : "/blog-admin");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/blog-admin/login");
}

export async function saveBlogDraft(slug: string, dto: UpdateBlogPostRequest) {
  await requireAdminSession();
  const updated = await updateBlogPost(slug, dto);
  revalidatePath(`/blog-admin/${slug}`);
  return updated;
}

export async function publishQueuedPost(slug: string) {
  await requireAdminSession();
  await publishBlogPost(slug);
  revalidatePath("/blog-admin");
  redirect("/blog-admin");
}

export async function deleteQueuedPost(slug: string) {
  await requireAdminSession();
  await deleteBlogPost(slug);
  revalidatePath("/blog-admin");
  redirect("/blog-admin");
}
