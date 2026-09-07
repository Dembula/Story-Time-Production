import { NextRequest, NextResponse } from "next/server";
import { actorHasAdminRight, requireAdminApiActor } from "@/lib/admin-api-auth";
import { fetchFinanceOverviewBundle } from "@/lib/finance/overview-bundle";
import { rowsToCsv } from "@/lib/csv-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const actor = await requireAdminApiActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });
  if (
    !actorHasAdminRight(actor, "canManageFinance") &&
    !actorHasAdminRight(actor, "canManageRevenue") &&
    !actor.isGod
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  try {
    const bundle = await fetchFinanceOverviewBundle({
      period: searchParams.get("period"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      sheetLimit: 2000,
    });

    const header = [
      `# Storytime finance export`,
      `# period=${bundle.period.key};label=${bundle.period.label}`,
      `# periodStart=${bundle.period.periodStart};periodEnd=${bundle.period.periodEnd}`,
      `# appleCommissionRate=${bundle.feeSettings.appleCommissionRate}`,
      `# viewerCreatorSplit=${bundle.feeSettings.viewerCreatorSplit}`,
      `# viewerPlatformSplit=${bundle.feeSettings.viewerPlatformSplit}`,
      `# marketplaceFeeRate=${bundle.feeSettings.marketplaceFeeRate}`,
    ].join("\r\n");

    const summary = rowsToCsv(
      ["metric", "valueZar"],
      [
        ["gross", bundle.totals.gross],
        ["gatewayFees", bundle.totals.gatewayFees],
        ["net", bundle.totals.net],
        ["viewerPoolNet", bundle.totals.viewerPoolNet],
        ["creatorPool", bundle.totals.creatorPool],
        ["platformRetainedViewer", bundle.totals.platformRetained],
        ["platformServiceRevenue", bundle.totals.platformServiceRevenue],
        ["platformTotalRetained", bundle.totals.platformTotalRetained],
        ["marketplaceFees", bundle.totals.marketplaceFees],
        ["marketplaceVolume", bundle.totals.marketplaceVolume],
        ["promoLiabilityZar", bundle.totals.promoLiabilityZar],
        ["fundingSettledZar", bundle.totals.fundingSettledZar],
        ["payfastItnFees", bundle.gateways.payfastItnFees],
        ["payfastEstimatedFees", bundle.gateways.payfastEstimatedFees],
        ["appleEstimatedFees", bundle.gateways.appleEstimatedFees],
        ["appleProceedsFees", bundle.gateways.appleProceedsFees],
        ["paymentCount", bundle.totals.paymentCount],
        ["marketplaceTxCount", bundle.totals.marketplaceTxCount],
        ["escrowHeldZar", bundle.retention.escrow.heldZar],
        ["treasuryPlatformRevenue", bundle.retention.treasury.platformRevenueBalance],
        ["treasuryCreatorRevenue", bundle.retention.treasury.creatorRevenueBalance],
      ],
    );

    const sheets = rowsToCsv(
      [
        "kind",
        "id",
        "paidAt",
        "provider",
        "purpose",
        "purposeLabel",
        "payerName",
        "payerEmail",
        "payeeName",
        "payeeEmail",
        "gross",
        "gatewayFee",
        "net",
        "platformShare",
        "creatorShare",
        "settlementSource",
        "fundingSource",
        "status",
        "currency",
      ],
      [...bundle.sheets, ...bundle.marketplaceSheets].map((r) => [
        r.kind,
        r.id,
        r.paidAt ?? "",
        r.provider,
        r.purpose,
        r.purposeLabel,
        r.payer.name ?? "",
        r.payer.email ?? "",
        r.payee?.name ?? "",
        r.payee?.email ?? "",
        r.gross,
        r.gatewayFee,
        r.net,
        r.platformShare,
        r.creatorShare,
        r.settlementSource ?? "",
        r.fundingSource,
        r.status,
        r.currency,
      ]),
    );

    const providers = rowsToCsv(
      ["provider", "count", "gross", "fees", "net"],
      bundle.byProvider.map((r) => [r.provider, r.count, r.gross, r.fees, r.net]),
    );

    const promoByCode = rowsToCsv(
      ["code", "kind", "target", "redemptionCount", "discountZar", "active"],
      bundle.promo.byCode.map((r) => [
        r.code,
        r.kind,
        r.target,
        r.redemptionCount,
        r.discountZar,
        r.active ? "true" : "false",
      ]),
    );

    const promoRecent = rowsToCsv(
      ["redeemedAt", "code", "kind", "context", "userEmail", "resultingPlan", "discountAmount"],
      bundle.promo.recent.map((r) => [
        r.redeemedAt,
        r.code,
        r.kind,
        r.context,
        r.user.email ?? "",
        r.resultingPlan ?? "",
        r.discountAmount,
      ]),
    );

    const fundingPayments = rowsToCsv(
      ["createdAt", "settledAt", "status", "amount", "project", "funderEmail", "creatorEmail"],
      bundle.funding.dealPayments.recent.map((p) => [
        p.createdAt,
        p.settledAt ?? "",
        p.status,
        p.amount,
        p.projectTitle ?? "",
        p.funder.email ?? "",
        p.creator.email ?? "",
      ]),
    );

    const retentionByPurpose = rowsToCsv(
      ["purpose", "purposeLabel", "category", "count", "gross", "gatewayFees", "net", "platformShare", "creatorShare"],
      bundle.retention.byPurpose.map((r) => [
        r.purpose,
        r.purposeLabel,
        r.category,
        r.count,
        r.gross,
        r.gatewayFees,
        r.net,
        r.platformShare,
        r.creatorShare,
      ]),
    );

    const body = [
      header,
      "",
      "# summary",
      summary,
      "",
      "# by_provider",
      providers,
      "",
      "# sheets",
      sheets,
      "",
      "# promo_by_code",
      promoByCode,
      "",
      "# promo_recent",
      promoRecent,
      "",
      "# funding_deal_payments",
      fundingPayments,
      "",
      "# retention_by_purpose",
      retentionByPurpose,
    ].join("\r\n");

    const filename = `storytime-finance-${bundle.period.key}-${bundle.period.periodStart.slice(0, 10)}.csv`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[finance/export]", err);
    return NextResponse.json({ error: "Could not export finance CSV." }, { status: 500 });
  }
}
