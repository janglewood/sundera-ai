"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { UpdateBlogPostRequest } from "@sundera/shared";
import { constantTimeEqual, sha256Hex, SESSION_COOKIE } from "@/lib/blog-admin-auth";
import { publishBlogPost, updateBlogPost } from "@/lib/blog-admin";

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
  const updated = await updateBlogPost(slug, dto);
  revalidatePath(`/blog-admin/${slug}`);
  return updated;
}

export async function publishQueuedPost(slug: string) {
  await publishBlogPost(slug);
  revalidatePath("/blog-admin");
  redirect("/blog-admin");
}
