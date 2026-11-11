import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildPersonPreview } from "@/lib/credit-person";
import { CreditPersonPageClient } from "./credit-person-page-client";
import { buildPublicAppUrl, getCanonicalPublicBaseUrl } from "@/lib/app-url";
import { buildPersonJsonLd, jsonLdScriptContent } from "@/lib/seo/content-json-ld";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ personId: string }>;
}): Promise<Metadata> {
  const { personId } = await params;
  const preview = await buildPersonPreview(personId);
  if (!preview) {
    return { title: "Person unavailable", robots: { index: false, follow: false } };
  }
  const base = getCanonicalPublicBaseUrl().replace(/\/$/, "");
  const pageUrl = buildPublicAppUrl(`/browse/people/${personId}`);
  const description =
    preview.blurb?.trim() ||
    preview.bio?.trim() ||
    `${preview.displayName} — credits on Story Time Universe`;
  const image = preview.imageUrl?.startsWith("http")
    ? preview.imageUrl
    : preview.imageUrl
      ? `${base}${preview.imageUrl.startsWith("/") ? "" : "/"}${preview.imageUrl}`
      : `${base}/logo.png`;

  return {
    title: preview.displayName,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "profile",
      url: pageUrl,
      siteName: "Story Time Universe",
      title: preview.displayName,
      description,
      images: [{ url: image, alt: preview.displayName }],
    },
    twitter: {
      card: "summary",
      title: preview.displayName,
      description,
      images: [image],
    },
  };
}

export default async function CreditPersonPage({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  const preview = await buildPersonPreview(personId);
  if (!preview) notFound();

  const personLd = buildPersonJsonLd({
    id: personId,
    displayName: preview.displayName,
    bio: preview.blurb || preview.bio,
    imageUrl: preview.imageUrl,
    jobTitles: (preview.roles ?? []).slice(0, 12),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(personLd) }}
      />
      <CreditPersonPageClient preview={preview} />
    </>
  );
}
