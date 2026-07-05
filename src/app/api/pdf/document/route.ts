import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { contractTermsToPdfBuffer } from "@/lib/legal/contract-pdf-export";
import { pdfAttachmentResponse } from "@/lib/pdf/document-pdf";

/** Authenticated PDF export for plain-text documents (contracts, notes). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    title?: string;
    terms?: string;
    filename?: string;
  } | null;

  const title = (body?.title ?? "Document").trim() || "Document";
  const terms = (body?.terms ?? "").trim();
  if (!terms) {
    return NextResponse.json({ error: "Document body is required" }, { status: 400 });
  }
  if (terms.length > 500_000) {
    return NextResponse.json({ error: "Document is too large to export" }, { status: 400 });
  }

  const pdf = contractTermsToPdfBuffer(terms, title);
  const filename = (body?.filename ?? `${title}.pdf`).replace(/[^\w.\-]+/g, "_");
  return pdfAttachmentResponse(pdf, filename);
}
