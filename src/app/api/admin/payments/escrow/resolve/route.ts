import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { releaseEscrow, refundEscrowToBuyer } from "@/lib/payments/escrow";
import { loadEscrowWithParties } from "@/lib/payments/escrow-access";

type Resolution = "release" | "refund";

/** Admin resolves a disputed or held escrow. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    escrowId?: string;
    resolution?: Resolution;
  } | null;

  if (!body?.escrowId || !body.resolution) {
    return NextResponse.json({ error: "escrowId and resolution are required." }, { status: 400 });
  }

  const escrow = await loadEscrowWithParties(body.escrowId);
  if (!escrow) return NextResponse.json({ error: "Escrow not found." }, { status: 404 });

  if (body.resolution === "release") {
    const released = await releaseEscrow({
      escrowId: body.escrowId,
      idempotencyKey: `admin_escrow_release_${body.escrowId}`,
    });
    return NextResponse.json({ ok: true, escrow: released });
  }

  const refunded = await refundEscrowToBuyer({
    escrowId: body.escrowId,
    idempotencyKey: `admin_escrow_refund_${body.escrowId}`,
  });
  return NextResponse.json({ ok: true, escrow: refunded });
}
