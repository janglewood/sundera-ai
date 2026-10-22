import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { BlogArticleBody } from "@/components/blog/BlogArticleBody";
import {
  formatPostDate,
  getBlogPost,
  getRelatedBlogPosts,
  listBlogPosts,
} from "@/lib/blog";
import { SITE_URL } from "@/lib/site";

interface BlogPostPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

// See app/blog/page.tsx — same force-dynamic reasoning (DB-backed content,
// no API reachable from the Docker build stage).
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — Sundera AI`,
    description: post.dek,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.dek,
      images: [post.imageUrl],
      type: "article",
      publishedTime: post.publishedAt,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug, locale } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const t = await getTranslations({ locale, namespace: "Blog" });
  const tRoomType = await getTranslations({ locale, namespace: "RoomTypes" });
  const tDesignStyle = await getTranslations({ locale, namespace: "DesignStyles" });
  const roomLabel = tRoomType(post.roomType);
  const styleLabel = tDesignStyle(post.style);
  const strings = {
    aiVizNote: t("thisIsAiViz", { style: styleLabel }),
    whatWasntWorking: t("whatWasntWorking"),
    whatChanged: t("whatChanged"),
    palette: t("palette"),
    materials: t("materials"),
    lightAccents: t("lightAccents"),
    howToGetThisLook: t("howToGetThisLook"),
    steps: [
      t("step1"),
      t("step2", { roomLabel }),
      t("step3", { styleLabel }),
    ] as [string, string, string],
    tryItFree: t("tryItFree"),
    whatCostInRealLife: t("whatCostInRealLife"),
    roughRanges: t("roughRanges"),
    item: t("item"),
    budget: t("budget"),
    midRange: t("midRange"),
    otherStylesForThisRoom: t("otherStylesForThisRoom"),
    questionsAnswers: t("questionsAnswers"),
    redesignMyRoom: t("redesignMyRoom"),
  };
  const allPosts = await listBlogPosts();
  const related = getRelatedBlogPosts(allPosts, post);
  const pageUrl = `${SITE_URL}/blog/${post.slug}`;
  const imageUrl = new URL(post.imageUrl, SITE_URL).toString();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.dek,
    image: [imageUrl],
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: { "@type": "Organization", name: "Sundera AI", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Sundera AI",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Header />
      <main className="flex-1 px-6 py-12 sm:px-8 sm:py-16">
        <BlogArticleBody
          post={post}
          slug={post.slug}
          roomLabel={roomLabel}
          styleLabel={styleLabel}
          dateLabel={t("publishedPrefix", {
            date: formatPostDate(post.publishedAt, locale),
          })}
          dateValue={post.publishedAt}
          related={related}
          strings={strings}
          locale={locale}
        />
      </main>
      <Footer />
    </div>
  );
}
