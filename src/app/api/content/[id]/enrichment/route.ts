import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enrichContentById } from "@/lib/ai-metadata/enrich-content";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "ADMIN" && role !== "CONTENT_CREATOR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const content = await prisma.content.findUnique({ where: { id }, select: { id: true, creatorId: true } });
  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (role === "CONTENT_CREATOR" && content.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  const result = await enrichContentById(id);
  if (!result) {
    return NextResponse.json({ error: "Enrichment failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "READY" });
}
