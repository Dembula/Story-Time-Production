"use client";

import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ChevronDown, Loader2, UserCircle2 } from "lucide-react";
import { CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY, CREATOR_STUDIO_PROFILES_QUERY_KEY } from "@/lib/pricing";

type StudioCompanySummary = { id: string; displayName: string; seatCap: number; ownerUserId: string } | null;

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

function formatProfileOptionLabel(p: StudioProfileRow): string {
  const companyName = p.company?.displayName?.trim();
  if (companyName) {
    const member = p.displayName?.trim();
    return member && member !== companyName ? `${companyName} · ${member}` : companyName;
  }
  if (p.kind === "COMPANY" || p.companyId) {
    return p.displayName?.trim() || "Company workspace";
  }
  const name = p.displayName?.trim();
  return name ? `${name} (Personal)` : "Personal workspace";
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

  const profiles = data?.profiles ?? [];
  const activeId = data?.activeCreatorStudioProfileId ?? null;
  const activeProfile = profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;
  const activeLabel =
    (activeProfile ? formatProfileOptionLabel(activeProfile) : null) ??
    session?.user?.name ??
    session?.user?.email ??
    "Creator";

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
      <div className="flex max-w-[280px] items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-400">
        <UserCircle2 className="h-4 w-4 shrink-0 text-orange-400" />
        <span>Loading workspace…</span>
      </div>
    );
  }

  if (multiWorkspace) {
    const selectValue = activeId && profiles.some((p) => p.id === activeId) ? activeId : profiles[0]?.id ?? "";
    return (
      <div className="flex max-w-[min(100vw-8rem,320px)] flex-col gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-left">
        <label htmlFor="creator-workspace-select" className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
          <UserCircle2 className="h-3.5 w-3.5 text-orange-400" aria-hidden />
          Workspace
          {switching ? <Loader2 className="h-3 w-3 animate-spin text-slate-500" aria-label="Switching" /> : null}
        </label>
        <div className="relative">
          <select
            id="creator-workspace-select"
            className="storytime-select w-full appearance-none truncate rounded-md border border-white/10 bg-slate-950/80 py-1.5 pl-2 pr-7 text-xs font-medium text-white focus:border-orange-400/50 focus:outline-none focus:ring-1 focus:ring-orange-400/30 disabled:opacity-60"
            value={selectValue}
            disabled={switching}
            onChange={(e) => void onSelectProfile(e.target.value)}
            title="Switch studio workspace"
            aria-busy={switching}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {formatProfileOptionLabel(p)}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
        </div>
        {switchError ? <p className="text-[11px] text-red-400">{switchError}</p> : null}
      </div>
    );
  }

  return (
    <div
      className="flex max-w-[260px] items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-left text-xs text-slate-200"
      title="Active studio workspace for this session"
    >
      <UserCircle2 className="h-4 w-4 shrink-0 text-orange-400" />
      <span className="min-w-0 flex-1 truncate">
        <span className="block text-[10px] uppercase tracking-wide text-slate-500">Workspace</span>
        <span className="font-medium text-white">{activeLabel}</span>
      </span>
    </div>
  );
}

/** @deprecated Use CreatorStudioActingLabel */
export const CreatorStudioSwitcher = CreatorStudioActingLabel;
