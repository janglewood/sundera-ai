import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { BlogPostsGrid, BLOG_INITIAL_PAGE_SIZE } from "@/components/blog/BlogPostsGrid";
import { listBlogPosts } from "@/lib/blog";

export async function generateMetadata(
  props: PageProps<"/[locale]/blog">,
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: t("blogTitle"),
    description: t("blogDescription"),
    alternates: { canonical: "/blog" },
  };
}

// Content is DB-backed and the Docker build stage has no network path to a
// live apps/api — a static/ISR page would try (and fail) to fetch at build
// time. force-dynamic renders per-request instead; cheap at today's traffic.
export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
  const t = await getTranslations("Blog");
  const posts = await listBlogPosts({ limit: BLOG_INITIAL_PAGE_SIZE });

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="flex-1 px-6 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
              {t("indexHeading")}
            </h1>
            <p className="mt-4 text-muted-foreground">
              {t("indexSubheading")}
            </p>
          </div>

          <BlogPostsGrid initialPosts={posts} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
