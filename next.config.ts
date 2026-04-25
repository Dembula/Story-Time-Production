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
  experimental: {
    staticGenerationMaxConcurrency: 1,
    staticGenerationRetryCount: 2,
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
