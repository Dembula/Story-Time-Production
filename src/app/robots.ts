import type { MetadataRoute } from "next";
import { getCanonicalPublicBaseUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const base = getCanonicalPublicBaseUrl().replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
