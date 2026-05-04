import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { markEscrowDisputed } from "@/lib/payments/escrow";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "SUBSCRIBER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { escrowId?: string } | null;
  if (!body?.escrowId) return NextResponse.json({ error: "escrowId is required." }, { status: 400 });

  const escrow = await markEscrowDisputed(body.escrowId);
  return NextResponse.json({ ok: true, escrow });
}
