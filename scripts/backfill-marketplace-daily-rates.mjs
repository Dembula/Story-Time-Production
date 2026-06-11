/**
 * Backfill dailyRate (and quantityAvailable) from embedded [ST_MARKET_META] blocks
 * into first-class columns. Safe to run multiple times — only updates null columns.
 *
 * Usage: node scripts/backfill-marketplace-daily-rates.mjs
 *        node scripts/backfill-marketplace-daily-rates.mjs --dry-run
 */
import { PrismaClient } from "../generated/prisma/index.js";

const MARKET_META_START = "[ST_MARKET_META]";
const MARKET_META_END = "[/ST_MARKET_META]";

function parseMeta(text) {
  const src = (text ?? "").trim();
  if (!src) return null;
  const start = src.indexOf(MARKET_META_START);
  const end = src.indexOf(MARKET_META_END);
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(src.slice(start + MARKET_META_START.length, end).trim());
  } catch {
    return null;
  }
}

const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

async function backfillLocationListings() {
  const rows = await prisma.locationListing.findMany({
    where: { dailyRate: null },
    select: { id: true, name: true, rules: true },
  });
  let updated = 0;
  for (const row of rows) {
    const meta = parseMeta(row.rules);
    const rate = meta?.dailyRate ?? meta?.hourlyRate;
    if (rate == null || !Number.isFinite(Number(rate))) continue;
    if (!dryRun) {
      await prisma.locationListing.update({
        where: { id: row.id },
        data: { dailyRate: Number(rate) },
      });
    }
    updated++;
  }
  return { table: "LocationListing", scanned: rows.length, updated };
}

async function backfillEquipmentListings() {
  const rows = await prisma.equipmentListing.findMany({
    where: { dailyRate: null },
    select: { id: true, companyName: true, description: true },
  });
  let updated = 0;
  for (const row of rows) {
    const meta = parseMeta(row.description);
    const rate = meta?.dailyRate;
    const qty = meta?.quantityAvailable;
    if (rate == null && qty == null) continue;
    const data = {};
    if (rate != null && Number.isFinite(Number(rate))) data.dailyRate = Number(rate);
    if (qty != null && Number.isFinite(Number(qty))) data.quantityAvailable = Math.round(Number(qty));
    if (Object.keys(data).length === 0) continue;
    if (!dryRun) await prisma.equipmentListing.update({ where: { id: row.id }, data });
    updated++;
  }
  return { table: "EquipmentListing", scanned: rows.length, updated };
}

async function backfillCrewMembers() {
  const rows = await prisma.crewTeamMember.findMany({
    where: { dailyRate: null },
    select: { id: true, name: true, bio: true, skills: true },
  });
  let updated = 0;
  for (const row of rows) {
    const meta = parseMeta(row.bio) ?? parseMeta(row.skills);
    const rate = meta?.dailyRate;
    if (rate == null || !Number.isFinite(Number(rate))) continue;
    if (!dryRun) {
      await prisma.crewTeamMember.update({
        where: { id: row.id },
        data: { dailyRate: Number(rate) },
      });
    }
    updated++;
  }
  return { table: "CrewTeamMember", scanned: rows.length, updated };
}

async function backfillCastingTalent() {
  const rows = await prisma.castingTalent.findMany({
    where: { dailyRate: null },
    select: { id: true, name: true, bio: true },
  });
  let updated = 0;
  for (const row of rows) {
    const meta = parseMeta(row.bio);
    const rate = meta?.dailyRate ?? meta?.projectRate;
    if (rate == null || !Number.isFinite(Number(rate))) continue;
    if (!dryRun) {
      await prisma.castingTalent.update({
        where: { id: row.id },
        data: { dailyRate: Number(rate) },
      });
    }
    updated++;
  }
  return { table: "CastingTalent", scanned: rows.length, updated };
}

async function backfillCrewRoleNeeds() {
  const rows = await prisma.crewRoleNeed.findMany({
    where: { dailyRate: null },
    select: { id: true, role: true, notes: true },
  });
  let updated = 0;
  for (const row of rows) {
    const meta = parseMeta(row.notes);
    const rate = meta?.dailyRate;
    if (rate == null || !Number.isFinite(Number(rate))) continue;
    if (!dryRun) {
      await prisma.crewRoleNeed.update({
        where: { id: row.id },
        data: { dailyRate: Number(rate) },
      });
    }
    updated++;
  }
  return { table: "CrewRoleNeed", scanned: rows.length, updated };
}

async function backfillEquipmentPlanItems() {
  const rows = await prisma.equipmentPlanItem.findMany({
    select: { id: true, category: true, notes: true, equipmentListingId: true },
  });
  let updatedListings = 0;
  for (const row of rows) {
    const meta = parseMeta(row.notes);
    const rate = meta?.dailyRate;
    if (rate == null || !row.equipmentListingId) continue;
    const listing = await prisma.equipmentListing.findUnique({
      where: { id: row.equipmentListingId },
      select: { dailyRate: true },
    });
    if (listing?.dailyRate != null) continue;
    if (!dryRun) {
      await prisma.equipmentListing.update({
        where: { id: row.equipmentListingId },
        data: { dailyRate: Number(rate) },
      });
    }
    updatedListings++;
  }
  return { table: "EquipmentPlanItem→Listing", scanned: rows.length, updated: updatedListings };
}

async function main() {
  console.log(dryRun ? "DRY RUN — no writes" : "Applying backfill…");
  const results = await Promise.all([
    backfillLocationListings(),
    backfillEquipmentListings(),
    backfillCrewMembers(),
    backfillCastingTalent(),
    backfillCrewRoleNeeds(),
    backfillEquipmentPlanItems(),
  ]);
  for (const r of results) {
    console.log(`${r.table}: scanned ${r.scanned}, updated ${r.updated}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
