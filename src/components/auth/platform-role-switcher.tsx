"use client";

import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, UserRound } from "lucide-react";

export const PLATFORM_ROLES_QUERY_KEY = ["me", "platform-roles"] as const;

type PlatformRoleOption = {
  role: string;
  label: string;
  description: string;
  homePath: string;
  portalScope: "VIEWER" | "CREATOR" | "ADMIN";
  group: "viewer" | "creator" | "admin";
};

type PlatformRolesPayload = {
  activeRole: string | null;
  roles: string[];
  options: PlatformRoleOption[];
  multiRole: boolean;
};

const chipClass =
  "flex min-w-0 max-w-[10rem] items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-left sm:max-w-[15rem]";

export function PlatformRoleSwitcher({
  variant = "dark",
  className = "",
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: session, update: updateSession, status } = useSession();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [...PLATFORM_ROLES_QUERY_KEY],
    queryFn: async (): Promise<PlatformRolesPayload | null> => {
      const res = await fetch("/api/me/platform-roles", { cache: "no-store" });
      if (!res.ok) return null;
      return res.json() as Promise<PlatformRolesPayload>;
    },
    enabled: status === "authenticated",
  });

  const activeOption = useMemo(() => {
    const activeRole = data?.activeRole ?? session?.user?.role ?? null;
    return data?.options.find((option) => option.role === activeRole) ?? null;
  }, [data, session?.user?.role]);

  const onSelectRole = useCallback(
    async (nextRole: string) => {
      if (!nextRole || nextRole === data?.activeRole || switching) return;
      setSwitching(true);
      setSwitchError(null);
      try {
        const res = await fetch("/api/me/platform-roles/active", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: nextRole, callbackUrl: pathname }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          session?: {
            role?: string;
            roles?: string[];
            portalScope?: "VIEWER" | "CREATOR" | "ADMIN";
            funderVerificationStatus?: string;
            payoutKycVerificationStatus?: string;
          };
          redirectUrl?: string;
        };
        if (!res.ok) {
          setSwitchError(typeof body.error === "string" ? body.error : "Could not switch profile.");
          return;
        }
        if (body.session) {
          await updateSession?.(body.session);
        }
        await queryClient.invalidateQueries({ queryKey: [...PLATFORM_ROLES_QUERY_KEY] });
        router.push(body.redirectUrl ?? activeOption?.homePath ?? "/");
        router.refresh();
      } catch {
        setSwitchError("Could not switch profile.");
      } finally {
        setSwitching(false);
      }
    },
    [activeOption?.homePath, data?.activeRole, pathname, queryClient, router, switching, updateSession],
  );

  if (status !== "authenticated" || pathname.startsWith("/auth")) return null;
  if (!isLoading && !data?.multiRole) return null;

  const label = activeOption?.label ?? "Profile";
  const textClass = variant === "light" ? "text-slate-700" : "text-slate-200";
  const menuClass =
    variant === "light"
      ? "border-slate-200 bg-white text-slate-900 shadow-xl"
      : "border-white/10 bg-slate-950 text-slate-100 shadow-2xl";

  if (isLoading) {
    return (
      <div className={`${chipClass} ${className}`}>
        <UserRound className="h-3.5 w-3.5 shrink-0 text-orange-400" />
        <span className={`truncate text-[11px] sm:text-xs ${textClass}`}>Profiles…</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <details className="group">
        <summary
          className={`${chipClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden ${switching ? "opacity-70" : ""}`}
        >
          {switching ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-orange-400" />
          ) : (
            <UserRound className="h-3.5 w-3.5 shrink-0 text-orange-400 sm:h-4 sm:w-4" />
          )}
          <span className={`min-w-0 truncate text-[11px] font-medium sm:text-xs ${textClass}`}>{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-open:rotate-180" />
        </summary>
        <div
          className={`absolute right-0 z-[80] mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border ${menuClass}`}
        >
          <div className="border-b border-white/10 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-300/90">Switch profile</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Each profile keeps its own dashboard and permissions.</p>
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {(data?.options ?? []).map((option) => {
              const active = option.role === data?.activeRole;
              return (
                <button
                  key={option.role}
                  type="button"
                  disabled={switching || active}
                  onClick={() => void onSelectRole(option.role)}
                  className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                    active ? "bg-orange-500/15" : "hover:bg-white/5"
                  } disabled:cursor-default`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{option.label}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{option.description}</p>
                  </div>
                  {active ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </details>
      {switchError ? <p className="absolute right-0 top-full mt-1 max-w-[14rem] text-[10px] text-red-400">{switchError}</p> : null}
    </div>
  );
}
