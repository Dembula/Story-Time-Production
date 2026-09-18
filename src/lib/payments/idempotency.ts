import { prisma } from "@/lib/prisma";
const db = prisma as any;

export async function getOrCreateLedgerBatch(args: {
  idempotencyKey: string;
  referenceType: string;
  referenceId: string;
  status?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    return await db.ledgerBatch.create({
      data: {
        idempotencyKey: args.idempotencyKey,
        referenceType: args.referenceType,
        referenceId: args.referenceId,
        status: args.status ?? "COMPLETED",
        metadata: args.metadata ?? {},
      },
    });
  } catch {
    const existing = await db.ledgerBatch.findUnique({
      where: { idempotencyKey: args.idempotencyKey },
    });
    if (existing) return existing;
    throw new Error(`Failed to create or load ledger batch ${args.idempotencyKey}`);
  }
}

export async function recordGatewayEventIfNew(args: {
  provider: string;
  eventType: string;
  eventId?: string | null;
  payload?: Record<string, unknown>;
  signatureVerified?: boolean;
}) {
  const eventId = args.eventId ?? null;
  try {
    return await db.gatewayEvent.create({
      data: {
        provider: args.provider,
        eventType: args.eventType,
        eventId,
        payload: args.payload ?? {},
        signatureVerified: args.signatureVerified ?? false,
      },
    });
  } catch {
    return null;
  }
}
