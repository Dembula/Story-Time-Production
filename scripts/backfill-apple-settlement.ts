/**
 * Backfill Apple PaymentRecord fee/settlement using current FinanceFeeSettings.
 * Does not rewrite CreatorPayout rows — only payment settlement fields.
 *
 * Usage: npx tsx scripts/backfill-apple-settlement.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "../generated/prisma";
import { applyAppleCommission, defaultFinanceFeeRates } from "../src/lib/finance/fee-math";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || !process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const prisma = new PrismaClient();

async function main() {
  const settingsRow = await prisma.financeFeeSettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const rate = settingsRow?.appleCommissionRate ?? defaultFinanceFeeRates().appleCommissionRate;

  const rows = await prisma.paymentRecord.findMany({
    where: {
      provider: "APPLE",
      status: "SUCCEEDED",
      amount: { gt: 0 },
    },
    select: {
      id: true,
      amount: true,
      settlementAmount: true,
      providerFeeAmount: true,
      settlementSource: true,
      metadata: true,
    },
  });

  let updated = 0;
  for (const row of rows) {
    const needs =
      row.providerFeeAmount == null ||
      row.settlementAmount == null ||
      Math.abs(Number(row.settlementAmount) - Number(row.amount)) < 0.0001 ||
      row.settlementSource === "apple_iap";
    if (!needs) continue;

    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    if (typeof meta.appleProceeds === "number" && meta.appleProceeds <= row.amount) {
      const proceeds = Math.round(Number(meta.appleProceeds) * 100) / 100;
      const fee = Math.round((row.amount - proceeds) * 100) / 100;
      await prisma.paymentRecord.update({
        where: { id: row.id },
        data: {
          providerFeeAmount: fee,
          settlementAmount: proceeds,
          settlementSource: "apple_proceeds",
          metadata: {
            ...meta,
            appleSettlementMode: "proceeds",
            appleGross: row.amount,
            appleProceeds: proceeds,
            appleFee: fee,
            appleSettlementBackfilledAt: new Date().toISOString(),
          },
        },
      });
      updated += 1;
      continue;
    }

    const applied = applyAppleCommission(row.amount, rate);
    await prisma.paymentRecord.update({
      where: { id: row.id },
      data: {
        providerFeeAmount: applied.fee,
        settlementAmount: applied.settlement,
        settlementSource: "apple_estimated",
        metadata: {
          ...meta,
          appleSettlementMode: "estimated_commission",
          appleCommissionRate: applied.rate,
          appleGross: applied.gross,
          appleFee: applied.fee,
          appleSettlement: applied.settlement,
          appleSettlementBackfilledAt: new Date().toISOString(),
        },
      },
    });
    updated += 1;
  }

  console.log(`Backfilled ${updated} / ${rows.length} Apple payments at rate ${rate}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
