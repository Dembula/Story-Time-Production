import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundMoney } from "@/lib/payments/config";
import {
  formatRevenuePeriodKey,
  getCalendarMonthRange,
  getPreviousCalendarMonthRange,
} from "@/lib/payments/creator-pool-distribution";
import { resolveGooglePlaySettlement } from "@/lib/payments/google-play/settlement";
import { bookGooglePlayLedgerIfCash } from "@/lib/payments/google-play/ledger";
import { applyAppleCommission, getFinanceFeeSettings } from "@/lib/finance/fee-settings";

const db = prisma as any;

/**
 * Import a Google Play Console remittance into PaymentRecord + clear immediately
 * so it enters the chosen calendar month's creator pool.
 *
 * Body:
 * - amountZar: number (required) — console earnings / proceeds for the period
 * - period?: "YYYY-MM" (defaults to previous calendar month)
 * - treatAsProceeds?: boolean (default true) — amount is net after Google fee
 * - reference?: string — idempotency / console payout id
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    amountZar?: number;
    period?: string;
    treatAsProceeds?: boolean;
    reference?: string;
  } | null;

  const amountZar = roundMoney(Number(body?.amountZar ?? 0));
  if (!(amountZar > 0)) {
    return NextResponse.json({ error: "amountZar must be > 0" }, { status: 400 });
  }

  let periodStart: Date;
  let periodEnd: Date;
  let periodKey: string;
  if (body?.period && /^\d{4}-\d{2}$/.test(body.period)) {
    const [y, m] = body.period.split("-").map(Number);
    ({ periodStart, periodEnd } = getCalendarMonthRange(y, m - 1));
    periodKey = formatRevenuePeriodKey(periodStart);
  } else {
    const prev = getPreviousCalendarMonthRange();
    periodStart = prev.periodStart;
    periodEnd = prev.periodEnd;
    periodKey = prev.periodKey;
  }

  const reference =
    String(body?.reference ?? "").trim() ||
    `google-play-console:${periodKey}:${amountZar.toFixed(2)}`;

  const existing = await db.paymentRecord.findFirst({
    where: {
      provider: "GOOGLE",
      OR: [{ providerPaymentId: reference }, { gatewayTransactionId: reference }],
    },
    select: { id: true, amount: true, settlementAmount: true, fundsClearedAt: true },
  });
  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyImported: true,
      paymentId: existing.id,
      periodKey,
      amount: existing.amount,
      settlementAmount: existing.settlementAmount,
      cleared: Boolean(existing.fundsClearedAt),
    });
  }

  const treatAsProceeds = body?.treatAsProceeds !== false;
  const feeSettings = await getFinanceFeeSettings();
  let gross = amountZar;
  let settlement = await resolveGooglePlaySettlement({
    gross: amountZar,
    proceedsAmount: treatAsProceeds ? amountZar : null,
    source: "console_remittance",
  });

  if (treatAsProceeds) {
    // Back-solve gross from proceeds using store commission so sheets show fee + net.
    const rate = feeSettings.appleCommissionRate;
    if (rate > 0 && rate < 1) {
      gross = roundMoney(amountZar / (1 - rate));
      const applied = applyAppleCommission(gross, rate);
      // Prefer exact proceeds match to imported console figure.
      settlement = {
        providerFeeAmount: roundMoney(gross - amountZar),
        settlementAmount: amountZar,
        settlementSource: "google_play_console",
        metadataExtras: {
          googleSettlementMode: "console_proceeds",
          googleCommissionRate: applied.rate,
          googleGross: gross,
          googleProceeds: amountZar,
          googleFee: roundMoney(gross - amountZar),
          consolePeriod: periodKey,
          consoleReference: reference,
        },
      };
    }
  }

  // Stamp paidAt inside the target month so monthly pool math includes it.
  const paidAt = new Date(periodEnd);
  paidAt.setUTCHours(12, 0, 0, 0);

  const created = await db.paymentRecord.create({
    data: {
      provider: "GOOGLE",
      purpose: "viewer_google_play_console_remittance",
      status: "SUCCEEDED",
      amount: gross,
      currency: "ZAR",
      providerPaymentId: reference,
      gatewayTransactionId: reference,
      settlementSource: settlement.settlementSource,
      settlementAmount: settlement.settlementAmount,
      providerFeeAmount: settlement.providerFeeAmount,
      paidAt,
      metadata: {
        source: "google_play_console_import",
        importedByUserId: session?.user?.id ?? null,
        periodKey,
        ...settlement.metadataExtras,
      },
    },
  });

  await bookGooglePlayLedgerIfCash({
    id: created.id,
    amount: gross,
    settlementAmount: settlement.settlementAmount,
    purpose: "viewer_google_play_console_remittance",
    clearImmediately: true,
  });

  return NextResponse.json({
    ok: true,
    alreadyImported: false,
    paymentId: created.id,
    periodKey,
    amount: gross,
    settlementAmount: settlement.settlementAmount,
    providerFeeAmount: settlement.providerFeeAmount,
    cleared: true,
  });
}
