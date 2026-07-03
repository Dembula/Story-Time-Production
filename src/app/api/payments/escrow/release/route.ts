import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { releaseEscrow } from "@/lib/payments/escrow";
import {
  loadEscrowWithParties,
  userCanReleaseEscrow,
} from "@/lib/payments/escrow-access";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { escrowId?: string } | null;
  if (!body?.escrowId) return NextResponse.json({ error: "escrowId is required." }, { status: 400 });

  const escrow = await loadEscrowWithParties(body.escrowId);
  if (!escrow) return NextResponse.json({ error: "Escrow not found." }, { status: 404 });

  if (!userCanReleaseEscrow(escrow, user.id, user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const released = await releaseEscrow({
    escrowId: body.escrowId,
    idempotencyKey: `escrow_release_${body.escrowId}`,
  });
  return NextResponse.json({ ok: true, escrow: released });
}
