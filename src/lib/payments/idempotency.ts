import { prisma } from "@/lib/prisma";
const db = prisma as any;

export async function getOrCreateLedgerBatch(args: {
  idempotencyKey: string;
  referenceType: string;
  referenceId: string;
  status?: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await db.ledgerBatch.findUnique({
    where: { idempotencyKey: args.idempotencyKey },
  });
  if (existing) return existing;
  return db.ledgerBatch.create({
    data: {
      idempotencyKey: args.idempotencyKey,
      referenceType: args.referenceType,
      referenceId: args.referenceId,
      status: args.status ?? "COMPLETED",
      metadata: args.metadata ?? {},
    },
  });
}

export async function recordGatewayEventIfNew(args: {
  provider: string;
  eventType: string;
  eventId?: string | null;
  payload?: Record<string, unknown>;
  signatureVerified?: boolean;
  processed?: boolean;
  processedAt?: Date | null;
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
        processed: args.processed ?? false,
        processedAt: args.processedAt ?? null,
      },
    });
  } catch {
    if (!eventId) return null;
    return db.gatewayEvent.update({
      where: {
        provider_eventType_eventId: {
          provider: args.provider,
          eventType: args.eventType,
          eventId,
        },
      },
      data: {
        payload: args.payload ?? {},
        signatureVerified: args.signatureVerified ?? false,
        processed: args.processed ?? false,
        processedAt: args.processedAt ?? null,
      },
    }).catch(() => null);
  }
}
