import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { completeEsignEnvelope } from "@/lib/legal/contract-esign-service";

/** Legacy webhook — kept for in-app envelope completion records only. External e-sign is not used. */
export async function POST(req: NextRequest) {
  const secret = process.env.ESIGN_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers.get("x-esign-secret");
    if (header !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const externalId = body.externalId ?? body.envelopeId ?? body.signature_request_id;
  const status = (body.status ?? body.event ?? "").toString().toUpperCase();

  if (!externalId) return NextResponse.json({ error: "Missing externalId" }, { status: 400 });

  const envelope = await prisma.contractEsignEnvelope.findFirst({ where: { externalId } });
  if (!envelope) return NextResponse.json({ error: "Envelope not found" }, { status: 404 });

  if (["COMPLETED", "SIGNED", "SIGNATURE_REQUEST_ALL_SIGNED"].includes(status)) {
    await completeEsignEnvelope(envelope.id, body);
    await prisma.projectContract.update({
      where: { id: envelope.contractId },
      data: { status: "EXECUTED", executedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
