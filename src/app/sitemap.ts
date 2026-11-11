import type { MetadataRoute } from "next";
import { getCanonicalPublicBaseUrl } from "@/lib/app-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getCanonicalPublicBaseUrl().replace(/\/$/, "");
  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/browse`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/auth/signin`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];
}
