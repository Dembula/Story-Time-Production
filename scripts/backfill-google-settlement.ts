/**
 * Backfill Google Play PaymentRecord fee/settlement using current FinanceFeeSettings
 * (same store commission rate as Apple). Skips free trials and console remittances
 * that already have a non-zero fee / proceeds split.
 *
 * Usage: npx tsx scripts/backfill-google-settlement.ts
 *        npx tsx scripts/backfill-google-settlement.ts --dry-run
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "../generated/prisma";
import { applyAppleCommission, defaultFinanceFeeRates } from "../src/lib/finance/fee-math";
import { roundMoney } from "../src/lib/payments/config";

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
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const settingsRow = await prisma.financeFeeSettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const rate = settingsRow?.appleCommissionRate ?? defaultFinanceFeeRates().appleCommissionRate;

  const rows = await prisma.paymentRecord.findMany({
    where: {
      provider: "GOOGLE",
      status: "SUCCEEDED",
      amount: { gt: 0 },
    },
    select: {
      id: true,
      amount: true,
      settlementAmount: true,
      providerFeeAmount: true,
      settlementSource: true,
      purpose: true,
      metadata: true,
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? ({ ...(row.metadata as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    if (meta.isFreeTrial === true || row.settlementSource === "free_trial") {
      skipped += 1;
      continue;
    }

    const feeNow = Number(row.providerFeeAmount ?? 0);
    const settleNow =
      row.settlementAmount != null && Number.isFinite(Number(row.settlementAmount))
        ? Number(row.settlementAmount)
        : Number(row.amount);
    const alreadySplit =
      feeNow > 0.001 && Math.abs(settleNow - Number(row.amount)) > 0.001;
    const source = String(row.settlementSource ?? "");
    if (
      alreadySplit &&
      (source === "google_estimated" ||
        source === "google_proceeds" ||
        source === "google_play_console")
    ) {
      skipped += 1;
      continue;
    }

    // Console remittance already stamped as net proceeds (+ optional back-solved fee).
    if (
      source === "google_play_console" &&
      typeof meta.googleProceeds === "number" &&
      feeNow > 0.001
    ) {
      skipped += 1;
      continue;
    }

    if (typeof meta.googleProceeds === "number" && meta.googleProceeds <= row.amount) {
      const proceeds = roundMoney(Number(meta.googleProceeds));
      const fee = roundMoney(Number(row.amount) - proceeds);
      console.log(
        `${dryRun ? "[dry] " : ""}${row.id} proceeds → fee ${fee} net ${proceeds} (gross ${row.amount})`,
      );
      if (!dryRun) {
        await prisma.paymentRecord.update({
          where: { id: row.id },
          data: {
            providerFeeAmount: fee,
            settlementAmount: proceeds,
            settlementSource: "google_proceeds",
            metadata: {
              ...meta,
              googleSettlementMode: "proceeds",
              googleGross: row.amount,
              googleProceeds: proceeds,
              googleFee: fee,
              googleSettlementBackfilledAt: new Date().toISOString(),
            },
          },
        });
      }
      updated += 1;
      continue;
    }

    const applied = applyAppleCommission(row.amount, rate);
    console.log(
      `${dryRun ? "[dry] " : ""}${row.id} estimated → fee ${applied.fee} net ${applied.settlement} (gross ${row.amount})`,
    );
    if (!dryRun) {
      await prisma.paymentRecord.update({
        where: { id: row.id },
        data: {
          providerFeeAmount: applied.fee,
          settlementAmount: applied.settlement,
          settlementSource: "google_estimated",
          metadata: {
            ...meta,
            googleSettlementMode: "estimated_commission",
            googleCommissionRate: applied.rate,
            googleGross: applied.gross,
            googleFee: applied.fee,
            googleSettlement: applied.settlement,
            googleSettlementBackfilledAt: new Date().toISOString(),
          },
        },
      });
    }
    updated += 1;
  }

  console.log(
    `${dryRun ? "Would backfill" : "Backfilled"} ${updated} / ${rows.length} Google payments at rate ${rate} (skipped ${skipped})`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
