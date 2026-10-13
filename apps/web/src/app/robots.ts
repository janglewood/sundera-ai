import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// A plain "allow everything" wildcard rule already covers every known AI
// crawler (GPTBot, ClaudeBot, Google-Extended, PerplexityBot, etc.) — listing
// them individually wouldn't change behavior, only add a list that goes
// stale as new ones appear.
export default function robots(): MetadataRoute.Robots {
  return {
    // /blog-admin is password-gated (see middleware.ts) but still worth an
    // explicit disallow — no reason to let it show up in a crawl at all.
    rules: [{ userAgent: "*", allow: "/", disallow: "/blog-admin" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
