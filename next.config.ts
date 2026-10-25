import type { NextConfig } from "next";

/**
 * Host of APP_URL (.env files are loaded before this config). `next dev` only serves
 * its dev assets to localhost; when the app is opened through a tunnel such as
 * https://xxxx.trycloudflare.com, that host must be allowed, so a new tunnel only
 * means editing APP_URL. An invalid APP_URL is reported by the env check at boot.
 */
function appHost(): string | undefined {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).hostname : undefined;
  } catch {
    return undefined;
  }
}

const host = appHost();

const nextConfig: NextConfig = {
  // libSQL loads a prebuilt native binary; keep it out of the server bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  poweredByHeader: false,
  allowedDevOrigins: host ? [host] : [],
};

export default nextConfig;
