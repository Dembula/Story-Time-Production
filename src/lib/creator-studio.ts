import { prisma } from "@/lib/prisma";
import { isCreatorLicensePeriodActive } from "@/lib/pricing";
import { computeStudioSuiteAccess, type CreatorSuiteAccessMap } from "@/lib/creator-suite-access";
import {
  isMissingCreatorStudioInfrastructure,
  isMissingUserStudioWorkspacePrismaField,
  isPrismaMissingTable,
} from "@/lib/prisma-missing-table";

export function computePipelineAccessFromParts(
  license: { type: string; yearlyExpiresAt: Date | null } | null,
  profile: { pipelineDisabledByAdmin: boolean; pipelineSectionMask?: unknown } | null,
): { pipelineAccess: boolean; licensePeriodActive: boolean } {
  const licensePeriodActive = Boolean(license && isCreatorLicensePeriodActive(license));
  const { pipelineAccess } = computeStudioSuiteAccess({ license, profile });
  return { pipelineAccess, licensePeriodActive };
}

/** Ensure film/music creators have at least one studio profile + active pointer (legacy user repair). */
export async function ensureCreatorStudioProfilesForUser(userId: string): Promise<void> {
  const profileDelegate = (prisma as unknown as { creatorStudioProfile?: { count: unknown } })
    .creatorStudioProfile;
  if (typeof profileDelegate?.count !== "function") {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!user || (user.role !== "CONTENT_CREATOR" && user.role !== "MUSIC_CREATOR")) return;

  let count: number;
  try {
    count = await prisma.creatorStudioProfile.count({ where: { userId } });
  } catch (e) {
    if (
      isPrismaMissingTable(e, "CreatorStudioProfile") ||
      isMissingCreatorStudioInfrastructure(e)
    ) {
      return;
    }
    throw e;
  }

  if (count > 0) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          activeCreatorStudioProfileId: true,
          creatorStudioProfiles: { select: { id: true }, take: 1, orderBy: { createdAt: "asc" } },
        },
      });
      if (u && !u.activeCreatorStudioProfileId && u.creatorStudioProfiles[0]) {
        await prisma.user.update({
          where: { id: userId },
          data: { activeCreatorStudioProfileId: u.creatorStudioProfiles[0].id },
        });
      }
    } catch (e) {
      if (
        isMissingUserStudioWorkspacePrismaField(e) ||
        isPrismaMissingTable(e, "CreatorStudioProfile") ||
        isMissingCreatorStudioInfrastructure(e)
      ) {
        return;
      }
      throw e;
    }
    return;
  }

  const display = (user.name?.trim() || user.email?.split("@")[0] || "Creator").slice(0, 120);
  try {
    const p = await prisma.creatorStudioProfile.create({
      data: {
        userId,
        companyId: null,
        displayName: display,
        kind: "INDIVIDUAL",
      },
    });
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { activeCreatorStudioProfileId: p.id },
      });
    } catch (e) {
      if (!isMissingUserStudioWorkspacePrismaField(e)) throw e;
    }
  } catch (e) {
    if (
      isPrismaMissingTable(e, "CreatorStudioProfile") ||
      isMissingCreatorStudioInfrastructure(e)
    ) {
      return;
    }
    throw e;
  }
}

/** License fields returned from DB (explicit select avoids loading all `User` scalars when migrations lag). */
const distributionLicenseRecordSelect = {
  id: true,
  type: true,
  yearlyExpiresAt: true,
  userId: true,
  creatorStudioProfileId: true,
  externalPaymentId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const activeStudioProfileSelect = {
  id: true,
  displayName: true,
  kind: true,
  companyId: true,
  pipelineDisabledByAdmin: true,
  pipelineSectionMask: true,
} as const;

export type StudioPipelineContext = {
  license: {
    id: string;
    type: string;
    yearlyExpiresAt: Date | null;
    userId: string;
    creatorStudioProfileId: string | null;
    externalPaymentId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  activeProfile: {
    id: string;
    displayName: string;
    kind: string;
    companyId: string | null;
    pipelineDisabledByAdmin: boolean;
  } | null;
  suiteAccess: CreatorSuiteAccessMap;
  pipelineAccess: boolean;
  licensePeriodActive: boolean;
};

export async function loadStudioPipelineContext(userId: string): Promise<StudioPipelineContext | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        creatorDistributionLicense: { select: distributionLicenseRecordSelect },
        activeCreatorStudioProfile: { select: activeStudioProfileSelect },
      },
    });
    if (!user) return null;

    const profile =
      user.activeCreatorStudioProfile ??
      (await prisma.creatorStudioProfile.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: activeStudioProfileSelect,
      }));

    const license = user.creatorDistributionLicense;
    const licensePeriodActive = Boolean(license && isCreatorLicensePeriodActive(license));
    const { suiteAccess, pipelineAccess } = computeStudioSuiteAccess({
      license,
      profile: profile
        ? {
            pipelineDisabledByAdmin: profile.pipelineDisabledByAdmin,
            pipelineSectionMask: profile.pipelineSectionMask,
          }
        : null,
    });

    return {
      license: license ?? null,
      activeProfile: profile
        ? {
            id: profile.id,
            displayName: profile.displayName,
            kind: profile.kind,
            companyId: profile.companyId,
            pipelineDisabledByAdmin: profile.pipelineDisabledByAdmin,
          }
        : null,
      suiteAccess,
      pipelineAccess,
      licensePeriodActive,
    };
  } catch (e) {
    if (!isMissingUserStudioWorkspacePrismaField(e) && !isMissingCreatorStudioInfrastructure(e)) {
      throw e;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        creatorDistributionLicense: { select: distributionLicenseRecordSelect },
      },
    });
    if (!user) return null;
    const license = user.creatorDistributionLicense;
    const licensePeriodActive = Boolean(license && isCreatorLicensePeriodActive(license));
    const { suiteAccess, pipelineAccess } = computeStudioSuiteAccess({ license, profile: null });
    return {
      license: license ?? null,
      activeProfile: null,
      suiteAccess,
      pipelineAccess,
      licensePeriodActive,
    };
  }
}
