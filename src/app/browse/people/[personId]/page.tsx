import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildPersonPreview } from "@/lib/credit-person";
import { CreditPersonPageClient } from "./credit-person-page-client";

export const dynamic = "force-dynamic";

export default async function CreditPersonPage({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  const preview = await buildPersonPreview(personId);
  if (!preview) notFound();
  return <CreditPersonPageClient preview={preview} />;
}
