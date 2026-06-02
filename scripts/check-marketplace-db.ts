import { prisma } from "../src/lib/prisma";

async function main() {
  const checks: [string, () => Promise<number>][] = [
    ["EquipmentListing", () => prisma.equipmentListing.count()],
    ["EquipmentRequest", () => prisma.equipmentRequest.count()],
    ["LocationListing", () => prisma.locationListing.count()],
    ["LocationBooking", () => prisma.locationBooking.count()],
    ["CrewTeam", () => prisma.crewTeam.count()],
    ["CrewTeamRequest", () => prisma.crewTeamRequest.count()],
    ["CateringCompany", () => prisma.cateringCompany.count()],
    ["CateringBooking", () => prisma.cateringBooking.count()],
    ["CastingAgency", () => prisma.castingAgency.count()],
  ];

  for (const [name, fn] of checks) {
    try {
      const count = await fn();
      console.log(`${name}: ${count} rows (OK)`);
    } catch (e) {
      console.error(`${name}: FAILED — ${e instanceof Error ? e.message : e}`);
      process.exitCode = 1;
    }
  }
}

main()
  .finally(() => prisma.$disconnect());
