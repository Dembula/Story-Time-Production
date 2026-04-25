import { Prisma } from "../../generated/prisma";

/** Prisma P2021: referenced table does not exist (migrations not applied). */
export function isPrismaMissingTable(error: unknown, tableName: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2021") {
    return false;
  }
  const table = (error.meta as { table?: string } | undefined)?.table;
  return typeof table === "string" && table.includes(tableName);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Prisma P2022 (column not in DB) or driver message — User.creator* registration columns not migrated yet.
 */
export function isMissingUserCreatorRegistrationColumns(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientValidationError) {
    const msg = messageOf(error);
    return msg.includes("creatorAccountStructure") || msg.includes("creatorTeamSeatCap");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
    const metaJson = JSON.stringify(error.meta ?? {});
    return (
      metaJson.includes("creatorAccountStructure") ||
      metaJson.includes("creatorTeamSeatCap") ||
      metaJson.includes("creator_account_structure") ||
      metaJson.includes("creator_team_seat_cap")
    );
  }
  const msg = messageOf(error);
  return (
    msg.includes("creatorAccountStructure") ||
    msg.includes("creatorTeamSeatCap") ||
    msg.includes("creator_account_structure") ||
    msg.includes("creator_team_seat_cap")
  );
}

/** Thrown when `prisma generate` was not run after adding studio models — `tx.studioCompany` is undefined at runtime. */
export const MISSING_PRISMA_STUDIO_DELEGATES = "MISSING_PRISMA_STUDIO_DELEGATES";

/** Generated Prisma client older than schema — `User` has no active profile / studio relation fields. */
export function isMissingUserStudioWorkspacePrismaField(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientValidationError) {
    const msg = messageOf(error);
    return (
      msg.includes("activeCreatorStudioProfileId") ||
      msg.includes("activeCreatorStudioProfile") ||
      msg.includes("creatorStudioProfiles")
    );
  }
  const msg = messageOf(error);
  return (
    (msg.includes("activeCreatorStudioProfileId") ||
      msg.includes("activeCreatorStudioProfile") ||
      msg.includes("creatorStudioProfiles")) &&
    (msg.includes("select") || msg.includes("include") || msg.includes("Unknown field"))
  );
}

/**
 * Studio profile / company tables or User.activeCreatorStudioProfileId missing in DB,
 * or Prisma client generated before those models (validation rejects nested writes / unknown fields).
 */
export function isMissingCreatorStudioInfrastructure(error: unknown): boolean {
  if (messageOf(error) === MISSING_PRISMA_STUDIO_DELEGATES) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    const msg = messageOf(error);
    if (
      msg.includes("creatorStudioProfile") ||
      msg.includes("studioCompany") ||
      msg.includes("activeCreatorStudioProfileId") ||
      msg.includes("CreatorStudioProfile") ||
      msg.includes("StudioCompany")
    ) {
      return true;
    }
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      const table = (error.meta as { table?: string } | undefined)?.table ?? "";
      return (
        table.includes("CreatorStudioProfile") ||
        table.includes("creator_studio_profile") ||
        table.includes("StudioCompany") ||
        table.includes("studio_company")
      );
    }
    if (error.code === "P2022") {
      const metaJson = JSON.stringify(error.meta ?? {});
      return (
        metaJson.includes("activeCreatorStudioProfileId") ||
        metaJson.includes("active_creator_studio_profile_id")
      );
    }
  }
  const msg = messageOf(error);
  return (
    msg.includes("CreatorStudioProfile") ||
    msg.includes("creator_studio_profile") ||
    msg.includes("StudioCompany") ||
    msg.includes("studio_company") ||
    msg.includes("active_creator_studio_profile_id") ||
    msg.includes("activeCreatorStudioProfileId")
  );
}
