import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Traced, minimal server bundle for the Docker runtime image — without
  // this, the runtime stage would need the full node_modules tree.
  output: "standalone",
  // Next 16's dev server 403s cross-origin asset/HMR requests by default.
  // Without this, loading the dev server from a LAN hostname (e.g. for
  // mobile testing) renders the SSR HTML but never hydrates — the page
  // looks fine but nothing is clickable.
  allowedDevOrigins: ["antonk.local"],
};

export default nextConfig;
