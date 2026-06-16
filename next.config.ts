import type { NextConfig } from "next";

type RemotePattern = {
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname?: string;
};

function parseRemotePattern(raw: string | undefined | null): RemotePattern | null {
  const value = raw?.trim();
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const u = new URL(withProtocol);
    return {
      protocol: u.protocol === "http:" ? "http" : "https",
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

const storagePublicPattern = parseRemotePattern(
  process.env.STORAGE_PUBLIC_BASE_URL ?? process.env.S3_PUBLIC_BASE_URL,
);
const storageEndpointPattern = parseRemotePattern(process.env.STORAGE_ENDPOINT ?? process.env.S3_ENDPOINT);
const cloudflareCustomerPattern = parseRemotePattern(process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.output = config.output ?? {};
      config.output.chunkLoadTimeout = 300_000;
      // On Windows, webpack's filesystem pack cache races when .next is touched by
      // multiple processes (or antivirus), causing ENOENT rename failures and 500s.
      if (process.platform === "win32") {
        config.cache = { type: "memory" };
      }
    }
    return config;
  },
  env: {
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? "true" : "false",
    NEXT_PUBLIC_GITHUB_AUTH_ENABLED: process.env.GITHUB_ID && process.env.GITHUB_SECRET ? "true" : "false",
    NEXT_PUBLIC_APPLE_AUTH_ENABLED: process.env.APPLE_ID && process.env.APPLE_SECRET ? "true" : "false",
    NEXT_PUBLIC_STREAM_SIGNED_URLS:
      process.env.NEXT_PUBLIC_STREAM_SIGNED_URLS === "true" ||
      process.env.CLOUDFLARE_STREAM_SIGNED_URLS === "true" ||
      Boolean(process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID?.trim()) ||
      Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim())
        ? "true"
        : "false",
  },
  images: {
    remotePatterns: [
      ...(storagePublicPattern ? [storagePublicPattern] : []),
      ...(storageEndpointPattern ? [storageEndpointPattern] : []),
      ...(cloudflareCustomerPattern ? [cloudflareCustomerPattern] : []),
      { protocol: "https", hostname: "videodelivery.net", pathname: "/**" },
      { protocol: "https", hostname: "watch.cloudflarestream.com", pathname: "/**" },
      { protocol: "https", hostname: "*.amazonaws.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
