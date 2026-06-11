import "server-only";

import { prisma } from "@/lib/prisma";
import { inferProductionContext } from "./va-script-inference";

/** Sample marketplace listings for VA chat context (locations, crew, equipment). */
export async function buildMarketplaceContextForProject(input: {
  scriptText?: string;
  sceneHeadings?: string[];
}): Promise<string> {
  const inference = inferProductionContext({
    scriptText: input.scriptText,
    sceneHeadings: input.sceneHeadings,
  });

  const cityFilter = inference.primaryCity?.toLowerCase() ?? null;

  const [locations, equipment, crewTeams] = await Promise.all([
    prisma.locationListing.findMany({
      take: 80,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, type: true, city: true, dailyRate: true },
    }),
    prisma.equipmentListing.findMany({
      take: 30,
      orderBy: { createdAt: "desc" },
      select: { id: true, companyName: true, category: true, location: true, dailyRate: true },
    }),
    prisma.crewTeam.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      select: { id: true, companyName: true, specializations: true, city: true },
    }),
  ]);

  const filteredLocs = cityFilter
    ? locations.filter((l) => l.city?.toLowerCase().includes(cityFilter))
    : locations;
  const locSample = (filteredLocs.length >= 3 ? filteredLocs : locations).slice(0, 12);

  const lines: string[] = [
    `**Marketplace snapshot (for budget & location assumptions)** — inferred region: ${inference.regionLabel}, ~${inference.estimatedShootDays} shoot day(s).`,
    "",
    "**Location listings (sample — use dailyRate for budget lines):**",
  ];

  if (locSample.length === 0) {
    lines.push("- No location listings in database yet.");
  } else {
    for (const loc of locSample) {
      lines.push(
        `- id=${loc.id} | "${loc.name}" | ${loc.type}${loc.city ? ` | ${loc.city}` : ""}${loc.dailyRate != null ? ` | R${loc.dailyRate.toLocaleString("en-ZA")}/day` : ""}`,
      );
    }
  }

  lines.push("", "**Equipment listings (sample):**");
  if (equipment.length === 0) {
    lines.push("- No equipment listings yet.");
  } else {
    for (const eq of equipment.slice(0, 8)) {
      lines.push(`- id=${eq.id} | ${eq.companyName} | ${eq.category}${eq.location ? ` | ${eq.location}` : ""}${eq.dailyRate != null ? ` | R${eq.dailyRate.toLocaleString("en-ZA")}/day` : ""}`);
    }
  }

  lines.push("", "**Crew teams (sample):**");
  if (crewTeams.length === 0) {
    lines.push("- No crew teams listed yet.");
  } else {
    for (const team of crewTeams.slice(0, 6)) {
      lines.push(
        `- id=${team.id} | ${team.companyName}${team.specializations ? ` | ${team.specializations}` : ""}${team.city ? ` | ${team.city}` : ""}`,
      );
    }
  }

  lines.push(
    "",
    "When building budgets, prefer **generate_smart_budget** — it links breakdown locations to these listings and applies ZAR day-rate assumptions for cast, crew, and equipment.",
  );

  return lines.join("\n");
}
