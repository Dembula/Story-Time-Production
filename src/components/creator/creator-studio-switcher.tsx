"use client";

import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Loader2, UserCircle2 } from "lucide-react";
import { CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY, CREATOR_STUDIO_PROFILES_QUERY_KEY } from "@/lib/pricing";

type StudioCompanySummary = {
  id: string;
  displayName: string;
  seatCap: number;
  ownerUserId: string;
} | null;

type StudioProfileRow = {
  id: string;
  displayName: string;
  kind: string;
  companyId: string | null;
  pipelineDisabledByAdmin?: boolean;
  company?: StudioCompanySummary;
};

type StudioProfilesPayload = {
  activeCreatorStudioProfileId: string | null;
  profiles: StudioProfileRow[];
};

export type WorkspaceProfileKind = "personal" | "company_admin" | "company_member";

export function classifyWorkspaceProfile(
  p: StudioProfileRow,
  userId?: string | null,
): WorkspaceProfileKind {
  if (!p.companyId) return "personal";
  if (p.company?.ownerUserId && userId && p.company.ownerUserId === userId) return "company_admin";
  return "company_member";
}

export function formatProfileOptionLabel(p: StudioProfileRow, userId?: string | null): string {
  const kind = classifyWorkspaceProfile(p, userId);
  const name = p.displayName?.trim();
  const companyName = p.company?.displayName?.trim();

  if (kind === "personal") {
    return name ? `Personal · ${name}` : "Personal workspace";
  }
  if (kind === "company_admin") {
    return companyName ? `Company · ${companyName} (Admin)` : "Company · Admin";
  }
  if (companyName && name && name !== companyName) {
    return `Company · ${companyName} · ${name}`;
  }
  return companyName ? `Company · ${companyName}` : "Company workspace";
}

function formatCompactProfileLabel(p: StudioProfileRow, userId?: string | null): string {
  const kind = classifyWorkspaceProfile(p, userId);
  const name = p.displayName?.trim();
  const companyName = p.company?.displayName?.trim();

  if (kind === "personal") return name ?? "Personal";
  if (kind === "company_admin") return companyName ?? "Company";
  return companyName ?? name ?? "Company";
}

function profileKindSubtitle(p: StudioProfileRow, userId?: string | null): string {
  const kind = classifyWorkspaceProfile(p, userId);
  if (kind === "personal") return "Your personal creator account";
  if (kind === "company_admin") return "Studio you own — invite & manage team";
  return "Team workspace — shared company access";
}

function sortProfiles(profiles: StudioProfileRow[], userId?: string | null): StudioProfileRow[] {
  const rank = (p: StudioProfileRow) => {
    const kind = classifyWorkspaceProfile(p, userId);
    if (kind === "personal") return 0;
    if (kind === "company_admin") return 1;
    return 2;
  };
  return [...profiles].sort(
    (a, b) => rank(a) - rank(b) || (a.displayName ?? "").localeCompare(b.displayName ?? ""),
  );
}

const chipShellClass =
  "flex min-w-0 max-w-[7rem] shrink items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-1 sm:max-w-[14rem] sm:gap-1.5 sm:rounded-lg sm:px-2 sm:py-1.5 md:max-w-[18rem]";

/**
 * Header chip for the active studio workspace. When the user has more than one
 * `CreatorStudioProfile` (e.g. personal + joined team), this becomes a dropdown
 * that switches `activeCreatorStudioProfileId` via the API and refreshes session.
 */
export function CreatorStudioActingLabel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, update: updateSession } = useSession();
  const role = session?.user?.role;
  const userId = session?.user?.id ?? null;
  const studioRoles = role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR";

  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [...CREATOR_STUDIO_PROFILES_QUERY_KEY],
    queryFn: async (): Promise<StudioProfilesPayload | null> => {
      const r = await fetch("/api/creator/studio-profiles");
      if (!r.ok) return null;
      return r.json() as Promise<StudioProfilesPayload>;
    },
    enabled: studioRoles,
  });

  const profiles = useMemo(
    () => sortProfiles(data?.profiles ?? [], userId),
    [data?.profiles, userId],
  );
  const activeId = data?.activeCreatorStudioProfileId ?? null;
  const activeProfile = profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;
  const activeLabel =
    (activeProfile ? formatCompactProfileLabel(activeProfile, userId) : null) ??
    session?.user?.name ??
    session?.user?.email ??
    "Creator";
  const activeFullLabel = activeProfile ? formatProfileOptionLabel(activeProfile, userId) : activeLabel;
  const activeSubtitle = activeProfile ? profileKindSubtitle(activeProfile, userId) : null;
  const multiWorkspace = profiles.length > 1;

  const onSelectProfile = useCallback(
    async (nextId: string) => {
      if (!nextId || nextId === activeId || switching) return;
      setSwitching(true);
      setSwitchError(null);
      try {
        const res = await fetch("/api/creator/studio-profiles/active", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId: nextId }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setSwitchError(typeof body.error === "string" ? body.error : "Could not switch workspace.");
          return;
        }
        await queryClient.invalidateQueries({ queryKey: [...CREATOR_STUDIO_PROFILES_QUERY_KEY] });
        await queryClient.invalidateQueries({ queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY] });
        await updateSession?.({ activeCreatorStudioProfileId: nextId });
        router.refresh();
      } catch {
        setSwitchError("Could not switch workspace.");
      } finally {
        setSwitching(false);
      }
    },
    [activeId, switching, queryClient, updateSession, router],
  );

  if (!studioRoles) return null;

  if (isLoading) {
    return (
      <div className={`${chipShellClass} text-[11px] text-slate-400 sm:text-xs`}>
        <UserCircle2 className="h-3.5 w-3.5 shrink-0 text-orange-400 sm:h-4 sm:w-4" />
        <span className="truncate">Loading…</span>
      </div>
    );
  }

  if (multiWorkspace) {
    const selectValue = activeId && profiles.some((p) => p.id === activeId) ? activeId : profiles[0]?.id ?? "";
    const selectTitle = [activeFullLabel, activeSubtitle, switchError].filter(Boolean).join(" — ");
    return (
      <div className={`${chipShellClass} relative`} title={selectTitle}>
        <UserCircle2 className="h-3.5 w-3.5 shrink-0 text-orange-400 sm:h-4 sm:w-4" aria-hidden />
        <select
          id="creator-workspace-select"
          className="storytime-select min-w-0 flex-1 appearance-none truncate border-0 bg-transparent py-0 pl-0 pr-4 text-[11px] font-medium text-white focus:outline-none focus:ring-0 disabled:opacity-60 sm:text-xs"
          value={selectValue}
          disabled={switching}
          onChange={(e) => void onSelectProfile(e.target.value)}
          title={selectTitle}
          aria-label="Switch workspace"
          aria-busy={switching}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {formatProfileOptionLabel(p, userId)}
            </option>
          ))}
        </select>
        {switching ? (
          <Loader2 className="absolute right-1 h-3 w-3 shrink-0 animate-spin text-slate-500" aria-label="Switching" />
        ) : (
          <ChevronDown className="pointer-events-none absolute right-0 h-3 w-3 shrink-0 text-slate-500" aria-hidden />
        )}
      </div>
    );
  }

  return (
    <div
      className={chipShellClass}
      title={[activeFullLabel, activeSubtitle].filter(Boolean).join(" — ")}
    >
      <UserCircle2 className="h-3.5 w-3.5 shrink-0 text-orange-400 sm:h-4 sm:w-4" aria-hidden />
      <span className="min-w-0 truncate text-[11px] font-medium text-white sm:text-xs">{activeLabel}</span>
    </div>
  );
}

/** @deprecated Use CreatorStudioActingLabel */
export const CreatorStudioSwitcher = CreatorStudioActingLabel;
