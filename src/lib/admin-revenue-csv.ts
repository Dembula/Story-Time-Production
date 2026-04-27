import { rowsToCsv } from "@/lib/csv-export";
import type { AdminRevenueBundle } from "@/lib/admin-revenue-bundle";

export function adminRevenueBundleToCsv(bundle: AdminRevenueBundle): string {
  const header = [
    `# Storytime admin revenue export`,
    `# periodStart=${bundle.periodStart.toISOString()};periodEnd=${bundle.periodEnd.toISOString()}`,
  ].join("\r\n");

  const creators = rowsToCsv(
    ["creatorId", "name", "email", "role", "watchPoolZar", "sharePct", "watchSeconds", "syncMtdZar", "contentCount", "trackCount"],
    bundle.creators.map((c) => [
      c.id,
      c.name ?? "",
      c.email ?? "",
      c.role,
      c.revenue,
      c.share,
      c.watchTime,
      c.syncEarnings,
      c.contentCount,
      c.trackCount,
    ]),
  );

  const content = rowsToCsv(
    ["contentId", "title", "type", "creatorName", "watchSeconds", "sharePct", "allocatedPoolZar"],
    bundle.contentRevenue.map((r) => [r.id, r.title, r.type, r.creatorName, r.watchTime, r.share, r.revenue]),
  );

  const summary = rowsToCsv(
    ["metric", "valueZar"],
    [
      ["viewerSubRevenue", bundle.viewerSub.viewerSubRevenue],
      ["creatorPoolFromSubs", bundle.viewerSub.creatorPoolFromSubs],
      ["storyTimeFromSubs", bundle.viewerSub.storyTimeFromSubs],
      ["marketplaceFeesMtd", bundle.transactionFees.totalFees],
      ["marketplaceVolumeMtd", bundle.transactionFees.totalVolume],
      ["companySubsCount", bundle.companySubs.count],
      ["companySubsRevenue", bundle.companySubs.revenue],
      ["distributionLicencesRevenue", bundle.distributionLicenses.revenue],
      ["syncDealsCountMtd", bundle.syncDeals.totalDeals],
      ["syncRevenueMtd", bundle.syncDeals.totalSyncRevenue],
      ["platformRevenuePoolMtd", bundle.platform.revenuePool],
    ],
  );

  return `${header}\r\n\r\n# creators\r\n${creators}\r\n\r\n# content\r\n${content}\r\n\r\n# summary\r\n${summary}`;
}
