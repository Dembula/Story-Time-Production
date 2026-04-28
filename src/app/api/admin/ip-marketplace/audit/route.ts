import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AuditFinding = {
  code: string;
  severity: "warning" | "critical";
  message: string;
  count: number;
  assetIds?: string[];
};

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { error: null as NextResponse | null };
}

async function computeAudit() {

  const [assets, txs, agreements] = await Promise.all([
    prisma.iPAsset.findMany({
      include: {
        ownershipStructures: {
          where: { endDate: null },
          select: { ownerId: true, ownershipPercentage: true, rightsType: true },
        },
      },
      take: 2000,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.iPTransaction.findMany({
      select: { id: true, ipAssetId: true, buyerId: true, sellerId: true, type: true, date: true },
      orderBy: { date: "desc" },
      take: 4000,
    }),
    prisma.iPLicensingAgreement.findMany({
      select: { id: true, ipAssetId: true, status: true, licenseeId: true, licensorId: true },
      take: 4000,
    }),
  ]);

  const byAssetTx = new Map<string, typeof txs>();
  for (const tx of txs) {
    const arr = byAssetTx.get(tx.ipAssetId) ?? [];
    arr.push(tx);
    byAssetTx.set(tx.ipAssetId, arr);
  }

  const byAssetAgreements = new Map<string, typeof agreements>();
  for (const a of agreements) {
    const arr = byAssetAgreements.get(a.ipAssetId) ?? [];
    arr.push(a);
    byAssetAgreements.set(a.ipAssetId, arr);
  }

  const findings: AuditFinding[] = [];

  const listingWithoutPrice = assets.filter((a) => a.status === "LISTED" && (!a.listingPrice || a.listingPrice <= 0));
  if (listingWithoutPrice.length > 0) {
    findings.push({
      code: "LISTED_WITHOUT_VALID_PRICE",
      severity: "critical",
      message: "Listed assets must always have a valid positive listingPrice.",
      count: listingWithoutPrice.length,
      assetIds: listingWithoutPrice.map((a) => a.id),
    });
  }

  const invalidOwnershipSplit = assets.filter((a) => {
    const total = a.ownershipStructures.reduce((sum, row) => sum + row.ownershipPercentage, 0);
    return a.ownershipStructures.length > 0 && Math.abs(total - 100) > 0.01;
  });
  if (invalidOwnershipSplit.length > 0) {
    findings.push({
      code: "INVALID_ACTIVE_OWNERSHIP_SPLIT",
      severity: "critical",
      message: "Active ownership split should total 100%.",
      count: invalidOwnershipSplit.length,
      assetIds: invalidOwnershipSplit.map((a) => a.id),
    });
  }

  const ownerMismatch = assets.filter((a) => {
    const owners = new Set(a.ownershipStructures.map((row) => row.ownerId));
    return a.ownershipStructures.length > 0 && !owners.has(a.currentOwnerId);
  });
  if (ownerMismatch.length > 0) {
    findings.push({
      code: "CURRENT_OWNER_NOT_IN_ACTIVE_STRUCTURE",
      severity: "critical",
      message: "currentOwnerId should exist in active ownership structures.",
      count: ownerMismatch.length,
      assetIds: ownerMismatch.map((a) => a.id),
    });
  }

  const soldButStillListed = assets.filter((a) => {
    const hasSale = (byAssetTx.get(a.id) ?? []).some((tx) => tx.type === "SALE");
    return a.status === "LISTED" && hasSale;
  });
  if (soldButStillListed.length > 0) {
    findings.push({
      code: "SOLD_ASSET_STILL_LISTED",
      severity: "critical",
      message: "Asset has sale transactions but remains LISTED.",
      count: soldButStillListed.length,
      assetIds: soldButStillListed.map((a) => a.id),
    });
  }

  const saleTransferMismatch = assets.filter((a) => {
    const latestSale = (byAssetTx.get(a.id) ?? [])
      .filter((tx) => tx.type === "SALE")
      .sort((l, r) => +new Date(r.date) - +new Date(l.date))[0];
    if (!latestSale) return false;
    return a.currentOwnerId !== latestSale.buyerId || a.status !== "SOLD";
  });
  if (saleTransferMismatch.length > 0) {
    findings.push({
      code: "SALE_TRANSFER_MISMATCH",
      severity: "critical",
      message: "Latest sale buyer/status does not match asset current owner/state.",
      count: saleTransferMismatch.length,
      assetIds: saleTransferMismatch.map((a) => a.id),
    });
  }

  const licenseWithoutAgreement = assets.filter((a) => {
    const hasLicenseTx = (byAssetTx.get(a.id) ?? []).some((tx) => tx.type === "LICENSE");
    const hasActiveAgreement = (byAssetAgreements.get(a.id) ?? []).some((ag) => ag.status === "ACTIVE");
    return hasLicenseTx && !hasActiveAgreement;
  });
  if (licenseWithoutAgreement.length > 0) {
    findings.push({
      code: "LICENSE_TX_WITHOUT_ACTIVE_AGREEMENT",
      severity: "warning",
      message: "License transaction exists but no active licensing agreement found.",
      count: licenseWithoutAgreement.length,
      assetIds: licenseWithoutAgreement.map((a) => a.id),
    });
  }

  if (findings.length > 0) {
    await prisma.opsIncident.createMany({
      data: findings.map((f) => ({
        kind: `ip_marketplace_${f.code.toLowerCase()}`,
        severity: f.severity,
        message: `${f.message} Count=${f.count}`,
        detail: { code: f.code, count: f.count, assetIds: f.assetIds ?? [] },
      })),
    });
  }

  return {
    ok: true,
    scanned: { assets: assets.length, transactions: txs.length, agreements: agreements.length },
    findings,
    riskScore: findings.reduce((score, f) => score + (f.severity === "critical" ? 5 : 2), 0),
  };
}

export async function GET() {
  const auth = await assertAdmin();
  if (auth.error) return auth.error;
  const report = await computeAudit();
  return NextResponse.json(report);
}

type ResolveAction =
  | "SOLD_ASSET_STILL_LISTED"
  | "SALE_TRANSFER_MISMATCH"
  | "CURRENT_OWNER_NOT_IN_ACTIVE_STRUCTURE"
  | "LISTED_WITHOUT_VALID_PRICE";

export async function POST(req: Request) {
  const auth = await assertAdmin();
  if (auth.error) return auth.error;

  const body = (await req.json().catch(() => null)) as
    | { action?: ResolveAction; dryRun?: boolean; limit?: number }
    | null;
  if (!body?.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }
  const action = body.action;
  const dryRun = body.dryRun !== false;
  const limit = Math.max(1, Math.min(200, Number.isFinite(body.limit) ? Number(body.limit) : 50));

  const [assets, txs] = await Promise.all([
    prisma.iPAsset.findMany({
      include: {
        ownershipStructures: {
          where: { endDate: null },
          orderBy: { startDate: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 3000,
    }),
    prisma.iPTransaction.findMany({
      where: { type: "SALE" },
      orderBy: { date: "desc" },
      take: 6000,
    }),
  ]);

  const txByAsset = new Map<string, typeof txs>();
  for (const tx of txs) {
    const arr = txByAsset.get(tx.ipAssetId) ?? [];
    arr.push(tx);
    txByAsset.set(tx.ipAssetId, arr);
  }

  const toFix: Array<{ assetId: string; patch: Record<string, unknown>; note: string }> = [];

  for (const asset of assets) {
    if (toFix.length >= limit) break;
    const sales = (txByAsset.get(asset.id) ?? []).filter((t) => t.type === "SALE");
    const latestSale = sales.sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];

    if (action === "SOLD_ASSET_STILL_LISTED") {
      if (asset.status === "LISTED" && latestSale) {
        toFix.push({
          assetId: asset.id,
          patch: { status: "SOLD", currentOwnerId: latestSale.buyerId },
          note: "Set SOLD state + align owner with latest buyer",
        });
      }
    }

    if (action === "SALE_TRANSFER_MISMATCH") {
      if (latestSale && (asset.currentOwnerId !== latestSale.buyerId || asset.status !== "SOLD")) {
        toFix.push({
          assetId: asset.id,
          patch: { status: "SOLD", currentOwnerId: latestSale.buyerId },
          note: "Aligned owner/status with latest sale transaction",
        });
      }
    }

    if (action === "CURRENT_OWNER_NOT_IN_ACTIVE_STRUCTURE") {
      const owners = new Set(asset.ownershipStructures.map((row) => row.ownerId));
      if (asset.ownershipStructures.length > 0 && !owners.has(asset.currentOwnerId)) {
        toFix.push({
          assetId: asset.id,
          patch: { structureFix: true },
          note: "Close active splits and create single FULL ownership for current owner",
        });
      }
    }

    if (action === "LISTED_WITHOUT_VALID_PRICE") {
      if (asset.status === "LISTED" && (!asset.listingPrice || asset.listingPrice <= 0)) {
        toFix.push({
          assetId: asset.id,
          patch: { status: "DRAFT" },
          note: "Unlisted invalid listing (status set to DRAFT)",
        });
      }
    }
  }

  if (!dryRun && toFix.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const item of toFix) {
        if (action === "CURRENT_OWNER_NOT_IN_ACTIVE_STRUCTURE") {
          await tx.iPOwnershipStructure.updateMany({
            where: { ipAssetId: item.assetId, endDate: null },
            data: { endDate: new Date() },
          });
          const asset = assets.find((a) => a.id === item.assetId)!;
          await tx.iPOwnershipStructure.create({
            data: {
              ipAssetId: item.assetId,
              ownerId: asset.currentOwnerId,
              ownershipPercentage: 100,
              rightsType: "FULL",
              startDate: new Date(),
            },
          });
        } else {
          await tx.iPAsset.update({
            where: { id: item.assetId },
            data: item.patch,
          });
        }
      }
      await tx.opsIncident.create({
        data: {
          kind: `ip_marketplace_fix_${action.toLowerCase()}`,
          severity: "warning",
          message: `Applied ${toFix.length} auto-fixes for ${action}`,
          detail: { action, affectedAssetIds: toFix.map((f) => f.assetId) },
        },
      });
    });
  }

  return NextResponse.json({
    ok: true,
    action,
    dryRun,
    candidates: toFix.length,
    changes: toFix,
  });
}
