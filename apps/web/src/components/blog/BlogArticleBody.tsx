import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import type { BlogFaqItem, BlogPriceRow, BlogPostSummary } from "@sundera/shared";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Shared between the public article page (app/blog/[slug]/page.tsx) and
// blog-admin's preview (app/blog-admin/[slug]/page.tsx) so a queued post's
// preview is pixel-identical to what goes live on publish — one JSX tree,
// not two copies that can drift apart.
export interface BlogArticleBodyPost {
  title: string;
  dek: string;
  imageUrl: string;
  imageAlt: string;
  problems: string[];
  palette: string;
  materials: string;
  lighting: string;
  priceTable: BlogPriceRow[];
  faq: BlogFaqItem[];
}

export interface BlogArticleBodyStrings {
  aiVizNote: string;
  whatWasntWorking: string;
  whatChanged: string;
  palette: string;
  materials: string;
  lightAccents: string;
  howToGetThisLook: string;
  steps: [string, string, string];
  tryItFree: string;
  whatCostInRealLife: string;
  roughRanges: string;
  item: string;
  budget: string;
  midRange: string;
  otherStylesForThisRoom: string;
  questionsAnswers: string;
  redesignMyRoom: string;
}

// English literals, used verbatim when the component renders outside the
// localized tree (blog-admin's live preview, which sits outside app/[locale]
// and has no NextIntlClientProvider) — see note above on why this component
// takes plain strings rather than calling useTranslations itself.
function defaultStrings(roomLabel: string, styleLabel: string): BlogArticleBodyStrings {
  return {
    aiVizNote: `This is an AI visualization made with Sundera: a real photo was uploaded, and the style applied was ${styleLabel}.`,
    whatWasntWorking: "What wasn't working",
    whatChanged: "What changed",
    palette: "Palette",
    materials: "Materials",
    lightAccents: "Light & accents",
    howToGetThisLook: "How to get this look in Sundera",
    steps: [
      "Upload a photo of your room.",
      `Choose the room type. ${roomLabel}.`,
      `Choose a design style. ${styleLabel}.`,
    ],
    tryItFree: "Try it free",
    whatCostInRealLife: "What it could cost in real life",
    roughRanges:
      "Rough, illustrative ranges, not a quote — actual cost depends on your region and contractor.",
    item: "Item",
    budget: "Budget",
    midRange: "Mid-range",
    otherStylesForThisRoom: "Other styles for this room",
    questionsAnswers: "Questions & answers",
    redesignMyRoom: "Redesign my room",
  };
}

interface BlogArticleBodyProps {
  post: BlogArticleBodyPost;
  slug: string;
  roomLabel: string;
  styleLabel: string;
  dateLabel: ReactNode;
  dateValue?: string;
  related?: BlogPostSummary[];
  strings?: BlogArticleBodyStrings;
  locale?: string;
}

// Every CTA on an article page needs attribution back to that specific
// article, not just "blog" in general — utm_campaign=<slug> is how we tell
// which article actually drove an upload.
function uploadCtaHref(slug: string): string {
  return `/?utm_source=blog&utm_campaign=${encodeURIComponent(slug)}#upload`;
}

export function BlogArticleBody({
  post,
  slug,
  roomLabel,
  styleLabel,
  dateLabel,
  dateValue,
  related = [],
  strings,
  locale = routing.defaultLocale,
}: BlogArticleBodyProps) {
  const resolvedStrings = strings ?? defaultStrings(roomLabel, styleLabel);
  const uploadHref = getPathname({ href: uploadCtaHref(slug), locale });
  const steps = resolvedStrings.steps;
  return (
    <article className="mx-auto w-full max-w-2xl">
      <p className="text-xs font-semibold tracking-wide text-accent-hover uppercase">
        {roomLabel} &middot; {styleLabel}
      </p>
      <h1 className="mt-2 font-display text-3xl leading-tight tracking-tight text-balance sm:text-4xl">
        {post.title}
      </h1>
      <time dateTime={dateValue} className="mt-2 block text-sm text-muted-foreground">
        {dateLabel}
      </time>
      <p className="mt-4 text-lg text-muted-foreground">{post.dek}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {resolvedStrings.aiVizNote}
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
      </figure>

      <section className="mt-12">
        <h2 className="font-display text-2xl tracking-tight">
          {resolvedStrings.whatWasntWorking}
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
          {resolvedStrings.whatChanged}
        </h2>
        <dl className="mt-4 space-y-4 text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">{resolvedStrings.palette}</dt>
            <dd className="mt-1">{post.palette}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">{resolvedStrings.materials}</dt>
            <dd className="mt-1">{post.materials}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">{resolvedStrings.lightAccents}</dt>
            <dd className="mt-1">{post.lighting}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-10 rounded-3xl border border-white/40 bg-card/40 p-6 shadow-lg shadow-black/5 backdrop-blur-xl sm:p-8">
        <h2 className="font-display text-2xl tracking-tight">
          {resolvedStrings.howToGetThisLook}
        </h2>
        <ol className="mt-4 space-y-2 text-muted-foreground">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="font-semibold text-accent">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <Link
          href={uploadHref}
          className="mt-6 inline-flex rounded-full bg-accent bg-linear-to-br from-accent to-accent-hover px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {resolvedStrings.tryItFree}
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl tracking-tight">
          {resolvedStrings.whatCostInRealLife}
        </h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-xl border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 font-semibold">{resolvedStrings.item}</th>
                <th className="px-4 py-3 font-semibold">{resolvedStrings.budget}</th>
                <th className="px-4 py-3 font-semibold">{resolvedStrings.midRange}</th>
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
          {resolvedStrings.roughRanges}
        </p>
      </section>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl tracking-tight">
            {resolvedStrings.otherStylesForThisRoom}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {related.map((candidate) => (
              <li key={candidate.slug}>
                <Link
                  href={getPathname({ href: `/blog/${candidate.slug}`, locale })}
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
          {resolvedStrings.questionsAnswers}
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
              <p className="mt-3 text-sm text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-12 flex justify-center">
        <Link
          href={uploadHref}
          className="inline-flex rounded-full bg-accent bg-linear-to-br from-accent to-accent-hover px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {resolvedStrings.redesignMyRoom}
        </Link>
      </div>
    </article>
  );
}
