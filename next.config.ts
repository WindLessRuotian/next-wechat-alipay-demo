import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL loads a prebuilt native binary; keep it out of the server bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  poweredByHeader: false,
};

export default nextConfig;
