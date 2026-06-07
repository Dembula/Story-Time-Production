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
  const [switchOk, setSwitchOk] = useState<string | null>(null);

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
    (activeProfile ? formatProfileOptionLabel(activeProfile, userId) : null) ??
    session?.user?.name ??
    session?.user?.email ??
    "Creator";
  const activeSubtitle = activeProfile ? profileKindSubtitle(activeProfile, userId) : null;

  const multiWorkspace = profiles.length > 1;

  const onSelectProfile = useCallback(
    async (nextId: string) => {
      if (!nextId || nextId === activeId || switching) return;
      setSwitching(true);
      setSwitchError(null);
      setSwitchOk(null);
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
        const nextProfile = profiles.find((p) => p.id === nextId);
        await queryClient.invalidateQueries({ queryKey: [...CREATOR_STUDIO_PROFILES_QUERY_KEY] });
        await queryClient.invalidateQueries({ queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY] });
        await updateSession?.({ activeCreatorStudioProfileId: nextId });
        router.refresh();
        if (nextProfile) {
          setSwitchOk(`Switched to ${formatProfileOptionLabel(nextProfile, userId)}`);
          window.setTimeout(() => setSwitchOk(null), 4000);
        }
      } catch {
        setSwitchError("Could not switch workspace.");
      } finally {
        setSwitching(false);
      }
    },
    [activeId, switching, profiles, userId, queryClient, updateSession, router],
  );

  if (!studioRoles) return null;

  const shellClass =
    "min-w-0 w-full max-w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-left sm:w-auto sm:max-w-[min(100vw-6rem,20rem)] md:max-w-[22rem]";

  if (isLoading) {
    return (
      <div className={`${shellClass} flex items-center gap-2 text-xs text-slate-400`}>
        <UserCircle2 className="h-4 w-4 shrink-0 text-orange-400" />
        <span className="truncate">Loading workspace…</span>
      </div>
    );
  }

  if (multiWorkspace) {
    const selectValue = activeId && profiles.some((p) => p.id === activeId) ? activeId : profiles[0]?.id ?? "";
    return (
      <div className={`${shellClass} flex flex-col gap-1`}>
        <label
          htmlFor="creator-workspace-select"
          className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500"
        >
          <UserCircle2 className="h-3.5 w-3.5 shrink-0 text-orange-400" aria-hidden />
          <span className="truncate">Switch workspace</span>
          {switching ? <Loader2 className="h-3 w-3 shrink-0 animate-spin text-slate-500" aria-label="Switching" /> : null}
        </label>
        <div className="relative min-w-0">
          <select
            id="creator-workspace-select"
            className="storytime-select w-full min-w-0 appearance-none truncate rounded-md border border-white/10 bg-slate-950/80 py-1.5 pl-2 pr-7 text-xs font-medium text-white focus:border-orange-400/50 focus:outline-none focus:ring-1 focus:ring-orange-400/30 disabled:opacity-60"
            value={selectValue}
            disabled={switching}
            onChange={(e) => void onSelectProfile(e.target.value)}
            title="Switch between personal and company creator workspaces"
            aria-busy={switching}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {formatProfileOptionLabel(p, userId)}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
        </div>
        {activeSubtitle ? (
          <p className="truncate text-[10px] leading-snug text-slate-500" title={activeSubtitle}>
            {activeSubtitle}
          </p>
        ) : null}
        {switchOk ? <p className="text-[10px] text-emerald-400">{switchOk}</p> : null}
        {switchError ? <p className="text-[10px] text-red-400">{switchError}</p> : null}
      </div>
    );
  }

  return (
    <div
      className={`${shellClass} grid grid-cols-[auto,minmax(0,1fr)] gap-x-2 gap-y-0.5`}
      title={activeSubtitle ?? "Active studio workspace for this session"}
    >
      <UserCircle2 className="col-start-1 row-start-1 row-span-2 h-4 w-4 shrink-0 self-center text-orange-400" />
      <span className="col-start-2 row-start-1 text-[10px] font-medium uppercase leading-none tracking-wide text-slate-500">
        Workspace
      </span>
      <span className="col-start-2 row-start-2 min-w-0 truncate text-xs font-medium leading-tight text-white">
        {activeLabel}
      </span>
    </div>
  );
}

/** @deprecated Use CreatorStudioActingLabel */
export const CreatorStudioSwitcher = CreatorStudioActingLabel;
