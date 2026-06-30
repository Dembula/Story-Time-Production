import { NextRequest, NextResponse } from "next/server";
import { guestRespondToContract, resolveGuestToken, canSignerActNow } from "@/lib/legal/contract-signer-service";
import { watermarkForStatus } from "@/lib/contract-lifecycle";

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const guest = await resolveGuestToken(token);
  if (!guest) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
  if (guest.usedAt) return NextResponse.json({ error: "Link already used" }, { status: 410 });
  if (guest.expiresAt < new Date()) return NextResponse.json({ error: "Link expired" }, { status: 410 });

  const contract = guest.contract;
  const version = contract.versions[0];
  const canSignNow =
    guest.signerId ? await canSignerActNow(guest.contractId, guest.signerId) : false;

  return NextResponse.json({
    projectTitle: contract.project.title,
    subject: contract.subject,
    status: contract.status,
    signingMode: contract.signingMode,
    watermark: watermarkForStatus(contract.status),
    terms: version?.terms ?? "",
    signerLabel: guest.signer?.label ?? guest.email,
    expiresAt: guest.expiresAt.toISOString(),
    canSignNow,
    waitingForPriorSigner: !canSignNow && contract.signingMode === "SEQUENTIAL",
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = (await req.json().catch(() => ({}))) as {
    action?: "ACCEPT" | "REJECT" | "REQUEST_CHANGES";
    signerName?: string;
    comment?: string | null;
  };

  const action = body.action ?? "ACCEPT";
  if (!body.signerName?.trim()) {
    return NextResponse.json({ error: "Signer name required" }, { status: 400 });
  }
  if ((action === "REJECT" || action === "REQUEST_CHANGES") && !body.comment?.trim()) {
    return NextResponse.json({ error: "Comment required for decline or change requests" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const result = await guestRespondToContract({
    token,
    action,
    signerName: body.signerName.trim(),
    comment: body.comment?.trim() || null,
    ipAddress: ip,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, contractId: result.contractId, action });
}
