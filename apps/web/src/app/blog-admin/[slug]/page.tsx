import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DESIGN_STYLE_LABELS, ROOM_TYPE_LABELS } from "@sundera/shared";
import { getAdminBlogPost } from "@/lib/blog-admin";
import { BlogAdminEditor } from "./BlogAdminEditor";

export const metadata: Metadata = {
  title: "Edit blog post — Sundera AI",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface BlogAdminEditPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BlogAdminEditPage({ params }: BlogAdminEditPageProps) {
  const { slug } = await params;
  const post = await getAdminBlogPost(slug);
  if (!post) notFound();

  return (
    <BlogAdminEditor
      post={post}
      roomLabel={ROOM_TYPE_LABELS[post.roomType]}
      styleLabel={DESIGN_STYLE_LABELS[post.style]}
    />
  );
}
