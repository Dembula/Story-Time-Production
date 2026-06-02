import { Prisma } from "../../generated/prisma";

/** User-facing message when casting ops tables are not migrated yet. */
export function castingAgencyDbErrorMessage(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2010") {
      return "Casting agency database tables are not ready. Run prisma migrate deploy on the server.";
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("CastingAuditionSubmission") ||
    message.includes("CastingTalentAvailability") ||
    message.includes("agencyCommissionPercent") ||
    message.includes("does not exist")
  ) {
    return "Casting agency database tables are not ready. Run prisma migrate deploy on the server.";
  }
  return null;
}

export function handleCastingAgencyApiError(error: unknown, fallback: string) {
  const migrationHint = castingAgencyDbErrorMessage(error);
  if (migrationHint) {
    console.error("Casting agency API (schema):", error);
    return { message: migrationHint, status: 503 };
  }
  console.error("Casting agency API:", error);
  return { message: fallback, status: 500 };
}
