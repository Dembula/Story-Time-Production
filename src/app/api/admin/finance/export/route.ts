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
    ].join("\r\n");

    const summary = rowsToCsv(
      ["metric", "valueZar"],
      [
        ["gross", bundle.totals.gross],
        ["gatewayFees", bundle.totals.gatewayFees],
        ["net", bundle.totals.net],
        ["viewerPoolNet", bundle.totals.viewerPoolNet],
        ["creatorPool", bundle.totals.creatorPool],
        ["platformRetained", bundle.totals.platformRetained],
        ["marketplaceFees", bundle.totals.marketplaceFees],
        ["marketplaceVolume", bundle.totals.marketplaceVolume],
        ["payfastItnFees", bundle.gateways.payfastItnFees],
        ["payfastEstimatedFees", bundle.gateways.payfastEstimatedFees],
        ["appleEstimatedFees", bundle.gateways.appleEstimatedFees],
        ["appleProceedsFees", bundle.gateways.appleProceedsFees],
        ["paymentCount", bundle.totals.paymentCount],
      ],
    );

    const sheets = rowsToCsv(
      [
        "id",
        "paidAt",
        "provider",
        "purpose",
        "gross",
        "gatewayFee",
        "net",
        "platformShare",
        "creatorShare",
        "settlementSource",
        "currency",
      ],
      bundle.sheets.map((r) => [
        r.id,
        r.paidAt ?? "",
        r.provider,
        r.purpose,
        r.gross,
        r.gatewayFee,
        r.net,
        r.platformShare,
        r.creatorShare,
        r.settlementSource ?? "",
        r.currency,
      ]),
    );

    const providers = rowsToCsv(
      ["provider", "count", "gross", "fees", "net"],
      bundle.byProvider.map((r) => [r.provider, r.count, r.gross, r.fees, r.net]),
    );

    const body = `${header}\r\n\r\n# summary\r\n${summary}\r\n\r\n# by_provider\r\n${providers}\r\n\r\n# sheets\r\n${sheets}`;
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
