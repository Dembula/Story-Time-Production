import { creatorHasPipelineAccess, isCreatorLicensePeriodActive } from "@/lib/pricing";
import { STUDIO_SUITE_OPTIONS, type StudioSuiteId, isValidSuiteList } from "@/lib/creator-team-invites";

export type CreatorSuiteAccessMap = Record<StudioSuiteId, boolean>;

export function defaultSuiteAccessOpen(): CreatorSuiteAccessMap {
  return Object.fromEntries(STUDIO_SUITE_OPTIONS.map((s) => [s.id, true])) as CreatorSuiteAccessMap;
}

export function parseProfileSuiteMask(mask: unknown): StudioSuiteId[] | null {
  if (mask == null) return null;
  if (typeof mask !== "object" || Array.isArray(mask)) return null;
  const suites = (mask as { suites?: unknown }).suites;
  if (suites === undefined) return null;
  if (!isValidSuiteList(suites)) return null;
  return suites as StudioSuiteId[];
}

function suitesFromLicense(
  license: { type: string; yearlyExpiresAt: Date | null } | null,
  licensePeriodActive: boolean,
): Set<StudioSuiteId> {
  const set = new Set<StudioSuiteId>();
  if (!license || !licensePeriodActive) return set;
  if (creatorHasPipelineAccess(license.type)) {
    STUDIO_SUITE_OPTIONS.forEach((o) => set.add(o.id));
    return set;
  }
  set.add("catalogue_upload");
  return set;
}

/**
 * Effective suite access = license entitlements ∩ optional profile mask ∩ admin pipeline kill-switch.
 * When `pipelineSectionMask` is absent, only the license (+ admin flag) applies.
 */
export function computeStudioSuiteAccess(input: {
  license: { type: string; yearlyExpiresAt: Date | null } | null;
  profile: {
    pipelineDisabledByAdmin: boolean;
    pipelineSectionMask?: unknown;
  } | null;
}): { suiteAccess: CreatorSuiteAccessMap; pipelineAccess: boolean } {
  const licensePeriodActive = Boolean(input.license && isCreatorLicensePeriodActive(input.license));
  let base = suitesFromLicense(input.license, licensePeriodActive);

  if (input.profile?.pipelineDisabledByAdmin) {
    base = new Set(base);
    base.delete("pipeline_pre");
    base.delete("pipeline_prod");
    base.delete("pipeline_post");
  }

  const maskList = input.profile ? parseProfileSuiteMask(input.profile.pipelineSectionMask) : null;
  let effective: Set<StudioSuiteId>;
  if (maskList == null) {
    effective = base;
  } else {
    effective = new Set(maskList.filter((id) => base.has(id)));
  }

  const suiteAccess = Object.fromEntries(
    STUDIO_SUITE_OPTIONS.map((o) => [o.id, effective.has(o.id)]),
  ) as CreatorSuiteAccessMap;

  const pipelineAccess =
    suiteAccess.pipeline_pre || suiteAccess.pipeline_prod || suiteAccess.pipeline_post;

  return { suiteAccess, pipelineAccess };
}

export function isStudioPathBlockedBySuites(pathname: string, suiteAccess: CreatorSuiteAccessMap): boolean {
  if (pathname.includes("/post-production/distribution")) {
    return !(suiteAccess.catalogue_upload || suiteAccess.pipeline_post);
  }
  if (pathname.startsWith("/creator/upload") || pathname.startsWith("/creator/originals")) {
    return !suiteAccess.catalogue_upload;
  }
  if (pathname.startsWith("/creator/analytics")) {
    return !suiteAccess.analytics;
  }
  if (pathname.startsWith("/creator/pre-production") || pathname.startsWith("/creator/pre/")) {
    return !suiteAccess.pipeline_pre;
  }
  if (pathname.startsWith("/creator/production")) {
    return !suiteAccess.pipeline_prod;
  }
  if (pathname.startsWith("/creator/post-production")) {
    return !suiteAccess.pipeline_post;
  }
  if (/\/creator\/projects\/[^/]+\/pre-production\//.test(pathname)) {
    return !suiteAccess.pipeline_pre;
  }
  if (/\/creator\/projects\/[^/]+\/production\//.test(pathname)) {
    return !suiteAccess.pipeline_prod;
  }
  if (/\/creator\/projects\/[^/]+\/post-production\//.test(pathname)) {
    return !suiteAccess.pipeline_post;
  }
  return false;
}

export function suiteBlockRedirect(pathname: string): string {
  if (pathname.startsWith("/creator/upload") || pathname.startsWith("/creator/originals")) {
    return "/creator/command-center?upgrade=catalogue";
  }
  if (pathname.startsWith("/creator/analytics")) {
    return "/creator/command-center?upgrade=analytics";
  }
  return "/creator/command-center?upgrade=pipeline";
}
