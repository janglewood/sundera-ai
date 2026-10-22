import type { MetadataRoute } from "next";
import { listBlogPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/site";
import { routing } from "@/i18n/routing";

// See app/blog/page.tsx — force-dynamic, not ISR: the Docker build stage has
// no network path to a live apps/api to fetch posts from at build time.
export const dynamic = "force-dynamic";

// Every URL is localized (routing.localePrefix "as-needed" means the
// default locale has no prefix) with hreflang alternates pointing at every
// other locale of the same path, per Google's guidance for multilingual
// sitemaps.
function withLocalePrefix(path: string, locale: string): string {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = `${SITE_URL}${withLocalePrefix(path, locale)}`;
  }
  return languages;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listBlogPosts();

  const entries: MetadataRoute.Sitemap = [];
  for (const locale of routing.locales) {
    entries.push({
      url: `${SITE_URL}${withLocalePrefix("", locale)}`,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: languageAlternates("") },
    });
    entries.push({
      url: `${SITE_URL}${withLocalePrefix("/blog", locale)}`,
      changeFrequency: "daily",
      priority: 0.8,
      alternates: { languages: languageAlternates("/blog") },
    });
    for (const post of posts) {
      entries.push({
        url: `${SITE_URL}${withLocalePrefix(`/blog/${post.slug}`, locale)}`,
        lastModified: post.publishedAt,
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: { languages: languageAlternates(`/blog/${post.slug}`) },
      });
    }
  }
  return entries;
}
