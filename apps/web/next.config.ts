import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Traced, minimal server bundle for the Docker runtime image — without
  // this, the runtime stage would need the full node_modules tree.
  output: "standalone",
  // Next 16's dev server 403s cross-origin asset/HMR requests by default.
  // Without this, loading the dev server from a LAN hostname (e.g. for
  // mobile testing) renders the SSR HTML but never hydrates — the page
  // looks fine but nothing is clickable.
  allowedDevOrigins: ["antonk.local"],
  // Blog post images live in a public R2 bucket (marketing/blog/'s bot
  // uploads there — see that package's CLAUDE.md), not apps/web/public, so
  // next/image needs the host allow-listed. Set once the bucket's public
  // dev URL / custom domain exists; next/image throws on an unconfigured
  // external host, so this must be a real value before any blog post uses
  // an R2-hosted image.
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_BLOG_IMAGE_HOST
      ? [{ protocol: "https", hostname: process.env.NEXT_PUBLIC_BLOG_IMAGE_HOST }]
      : [],
  },
  // Pinterest's profile "website" field doesn't allow query params, so we
  // can't put UTM tags directly on the profile link. Instead the profile
  // links here, and this redirects to the real landing page with UTM tags
  // attached — not permanent, so the campaign params can change later
  // without browsers caching the old redirect.
  async redirects() {
    return [
      {
        source: "/pinterest",
        destination:
          "/?utm_source=pinterest&utm_medium=social&utm_campaign=profile",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
