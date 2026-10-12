import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { DESIGN_STYLE_LABELS, ROOM_TYPE_LABELS } from "@sundera/shared";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import {
  formatPostDate,
  getBlogPost,
  getRelatedBlogPosts,
  listBlogPosts,
} from "@/lib/blog";
import { SITE_URL } from "@/lib/site";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
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

const STEPS = [
  "Upload a photo of your room.",
  "Choose the room type.",
  "Choose a design style.",
];

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const roomLabel = ROOM_TYPE_LABELS[post.roomType];
  const styleLabel = DESIGN_STYLE_LABELS[post.style];
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
        <article className="mx-auto w-full max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-accent-hover uppercase">
            {roomLabel} &middot; {styleLabel}
          </p>
          <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-balance sm:text-4xl">
            {post.title}
          </h1>
          <time
            dateTime={post.publishedAt}
            className="mt-2 block text-sm text-muted-foreground"
          >
            Published {formatPostDate(post.publishedAt)}
          </time>
          <p className="mt-4 text-lg text-muted-foreground">{post.dek}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This is an AI visualization made with Sundera: a real photo was
            uploaded, and the style applied was {styleLabel}.
          </p>

          <figure className="mt-8">
            <div className="relative aspect-2/3 w-full overflow-hidden rounded-3xl shadow-xl shadow-black/10">
              <Image
                src={post.imageUrl}
                alt={post.imageAlt}
                fill
                sizes="(min-width: 640px) 42rem, 100vw"
                className="object-cover"
                priority
              />
            </div>
            <figcaption className="mt-2 text-center text-xs text-muted-foreground">
              AI visualization. Details may differ from a real renovation.
            </figcaption>
          </figure>

          <section className="mt-12">
            <h2 className="font-display text-2xl tracking-tight">
              What wasn&rsquo;t working
            </h2>
            <ul className="mt-4 space-y-2 text-muted-foreground">
              {post.problems.map((problem) => (
                <li key={problem} className="flex gap-2">
                  <span aria-hidden className="text-accent">
                    &bull;
                  </span>
                  <span>{problem}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl tracking-tight">
              What changed
            </h2>
            <dl className="mt-4 space-y-4 text-muted-foreground">
              <div>
                <dt className="font-medium text-foreground">Palette</dt>
                <dd className="mt-1">{post.palette}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Materials</dt>
                <dd className="mt-1">{post.materials}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">
                  Light &amp; accents
                </dt>
                <dd className="mt-1">{post.lighting}</dd>
              </div>
            </dl>
          </section>

          <section className="mt-10 rounded-3xl border border-white/40 bg-card/40 p-6 shadow-lg shadow-black/5 backdrop-blur-xl sm:p-8">
            <h2 className="font-display text-2xl tracking-tight">
              How to get this look in Sundera
            </h2>
            <ol className="mt-4 space-y-2 text-muted-foreground">
              {STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="font-semibold text-accent">{index + 1}.</span>
                  <span>
                    {step}
                    {index === 1 && ` ${roomLabel}.`}
                    {index === 2 && ` ${styleLabel}.`}
                  </span>
                </li>
              ))}
            </ol>
            <Link
              href="/#upload"
              className="mt-6 inline-flex rounded-full bg-accent bg-linear-to-br from-accent to-accent-hover px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Try it free
            </Link>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-2xl tracking-tight">
              What it could cost in real life
            </h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-xl border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 font-semibold">Item</th>
                    <th className="px-4 py-3 font-semibold">Budget</th>
                    <th className="px-4 py-3 font-semibold">Mid-range</th>
                  </tr>
                </thead>
                <tbody>
                  {post.priceTable.map((row) => (
                    <tr key={row.item} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{row.item}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.budget}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.mid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Rough, illustrative ranges, not a quote — actual cost depends on
              your region and contractor.
            </p>
          </section>

          {related.length > 0 && (
            <section className="mt-10">
              <h2 className="font-display text-2xl tracking-tight">
                Other styles for this room
              </h2>
              <ul className="mt-4 flex flex-wrap gap-3">
                {related.map((candidate) => (
                  <li key={candidate.slug}>
                    <Link
                      href={`/blog/${candidate.slug}`}
                      className="inline-flex rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/40"
                    >
                      {candidate.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10">
            <h2 className="font-display text-2xl tracking-tight">
              Questions &amp; answers
            </h2>
            <div className="mt-4 divide-y divide-white/30 rounded-3xl border border-white/40 bg-card/40 px-6 shadow-lg shadow-black/5 backdrop-blur-xl">
              {post.faq.map((item) => (
                <details key={item.question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:content-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                    {item.question}
                    <Plus
                      size={18}
                      weight="bold"
                      aria-hidden
                      className="shrink-0 text-accent transition-transform duration-200 group-open:rotate-45"
                    />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <div className="mt-12 flex justify-center">
            <Link
              href="/#upload"
              className="inline-flex rounded-full bg-accent bg-linear-to-br from-accent to-accent-hover px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Redesign my room
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
