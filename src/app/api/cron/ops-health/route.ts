import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../../../generated/prisma";

function isAuthorizedCronCall(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${expected}`;
}

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronCall(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const day = dayKey(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 1);

  const [orphanLocation, orphanCatering, orphanEquipment, orphanCrew, orphanCasting, failedPayments] = await Promise.all([
    prisma.locationBooking.count({ where: { paymentTransactionId: { not: null }, status: { in: ["PENDING", "APPROVED"] } } }),
    prisma.cateringBooking.count({ where: { paymentTransactionId: { not: null }, status: { in: ["PENDING", "APPROVED"] } } }),
    prisma.equipmentRequest.count({ where: { paymentTransactionId: { not: null }, status: { in: ["PENDING", "ACCEPTED"] } } }),
    prisma.crewTeamRequest.count({ where: { paymentTransactionId: { not: null }, status: { in: ["PENDING", "ACCEPTED"] } } }),
    prisma.castingInquiry.count({ where: { paymentTransactionId: { not: null }, status: { in: ["PENDING", "APPROVED"] } } }),
    prisma.transaction.count({ where: { status: "FAILED", createdAt: { gte: start, lte: now } } }),
  ]);

  const incidents: {
    kind: string;
    message: string;
    severity?: "warning" | "critical";
    detail?: Prisma.InputJsonValue;
  }[] = [];
  const orphanTotal = orphanLocation + orphanCatering + orphanEquipment + orphanCrew + orphanCasting;
  if (orphanTotal > 0) {
    incidents.push({
      kind: `orphan_paid_records_${day}`,
      message: `${orphanTotal} records have paymentTransactionId but are not marked settled.`,
      severity: "critical",
      detail: { orphanLocation, orphanCatering, orphanEquipment, orphanCrew, orphanCasting },
    });
  }
  if (failedPayments > 20) {
    incidents.push({
      kind: `failed_payments_spike_${day}`,
      message: `Failed transaction spike in last 24h: ${failedPayments}.`,
      severity: "warning",
      detail: { failedPayments24h: failedPayments },
    });
  }

  if (incidents.length) {
    await prisma.opsIncident.createMany({
      data: incidents.map((i) => ({
        kind: i.kind,
        message: i.message,
        severity: i.severity ?? "warning",
        detail: i.detail,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ ok: true, created: incidents.length });
}
