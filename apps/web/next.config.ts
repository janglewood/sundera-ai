import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Traced, minimal server bundle for the Docker runtime image — without
  // this, the runtime stage would need the full node_modules tree.
  output: "standalone",
};

export default nextConfig;
