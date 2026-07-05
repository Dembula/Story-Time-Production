import "server-only";

import type { FunderVerificationStatus } from "@/lib/funder-verification";
import { getPayoutKycStatus, requiresPayoutKyc, type KycVerificationStatus } from "@/lib/payout-kyc";
import { prisma } from "@/lib/prisma";
import { getUserRoles } from "@/lib/user-roles";
import { buildPlatformRoleOption, normalizePlatformRole, sortPlatformRoles } from "@/lib/platform-roles-shared";
import type { PortalScope } from "@/lib/platform-roles-shared";
import type { PlatformRole } from "@/lib/user-roles-shared";

export async function loadUserPlatformRoles(
  userId: string,
  fallbackRole?: string | null,
): Promise<PlatformRole[]> {
  const roles = await getUserRoles(userId, fallbackRole);
  return sortPlatformRoles(roles);
}

export async function persistActivePlatformRole(userId: string, role: PlatformRole): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });
}

export async function resolveRoleSwitch(
  userId: string,
  requestedRole: string,
  fallbackRole?: string | null,
): Promise<
  | {
      ok: true;
      role: PlatformRole;
      roles: PlatformRole[];
      portalScope: PortalScope;
      homePath: string;
      funderVerificationStatus?: FunderVerificationStatus;
      payoutKycVerificationStatus?: KycVerificationStatus;
    }
  | { ok: false; error: string; status: number }
> {
  const role = normalizePlatformRole(requestedRole);
  if (!role) {
    return { ok: false, error: "Invalid role", status: 400 };
  }

  const roles = await loadUserPlatformRoles(userId, fallbackRole);
  if (!roles.includes(role)) {
    return { ok: false, error: "This profile is not enabled on your account", status: 403 };
  }

  await persistActivePlatformRole(userId, role);

  let funderVerificationStatus: FunderVerificationStatus | undefined;
  if (role === "FUNDER") {
    const profile = await prisma.funderProfile.findUnique({
      where: { userId },
      select: { verificationStatus: true },
    });
    funderVerificationStatus =
      (profile?.verificationStatus as FunderVerificationStatus | undefined) ?? undefined;
  }

  const payoutKycVerificationStatus = requiresPayoutKyc(role)
    ? (await getPayoutKycStatus(userId)) ?? undefined
    : undefined;

  const option = buildPlatformRoleOption(role);

  return {
    ok: true,
    role,
    roles,
    portalScope: option.portalScope,
    homePath: option.homePath,
    funderVerificationStatus,
    payoutKycVerificationStatus,
  };
}
