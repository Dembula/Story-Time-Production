import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCreatorSession } from "@/lib/meet/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Distinct emails this creator has invited to Meets before. */
export async function GET() {
  const session = await requireCreatorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.meetInvite.findMany({
    where: {
      invitedByUserId: session.userId,
      email: { not: null },
    },
    select: { email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const seen = new Set<string>();
  const emails: string[] = [];
  for (const row of rows) {
    const email = String(row.email ?? "")
      .trim()
      .toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
    if (emails.length >= 40) break;
  }

  return NextResponse.json({ emails });
}
