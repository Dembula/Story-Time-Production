"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, Lock, ShieldCheck, X } from "lucide-react";
import {
  getFunderVerificationBannerContent,
  funderInvestingUnlocked,
  isFunderRole,
  type FunderVerificationStatus,
} from "@/lib/funder-verification";

const VARIANT_STYLES = {
  not_submitted: {
    border: "border-amber-400/30",
    bg: "bg-amber-500/10",
    icon: AlertTriangle,
    iconClass: "text-amber-300",
    titleClass: "text-amber-100",
  },
  pending: {
    border: "border-sky-400/25",
    bg: "bg-sky-500/10",
    icon: ShieldCheck,
    iconClass: "text-sky-300",
    titleClass: "text-sky-100",
  },
  under_review: {
    border: "border-sky-400/25",
    bg: "bg-sky-500/10",
    icon: ShieldCheck,
    iconClass: "text-sky-300",
    titleClass: "text-sky-100",
  },
  rejected: {
    border: "border-red-400/30",
    bg: "bg-red-500/10",
    icon: AlertTriangle,
    iconClass: "text-red-300",
    titleClass: "text-red-100",
  },
} as const;

function dismissKey(status: string) {
  return `storytime_funder_kyc_dismissed_${status}`;
}

export function useFunderVerificationState() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const { data, isLoading } = useQuery({
    queryKey: ["funder-verification-banner"],
    queryFn: async () => fetch("/api/funders/verification").then((r) => r.json()),
    enabled: isFunderRole(role),
    staleTime: 60_000,
  });

  const profile = data?.profile as
    | {
        verificationStatus?: FunderVerificationStatus;
        reviewNote?: string | null;
        submittedAt?: string | null;
        verifications?: { status: string; note?: string | null }[];
      }
    | undefined;

  const rejectionNote =
    profile?.reviewNote ??
    profile?.verifications?.find((v) => v.status === "REJECTED" && v.note)?.note ??
    null;

  const sessionStatus = (session?.user as { funderVerificationStatus?: FunderVerificationStatus })
    ?.funderVerificationStatus;

  const verificationStatus = profile?.verificationStatus ?? sessionStatus ?? null;

  return {
    isLoading,
    verificationStatus,
    investingUnlocked: funderInvestingUnlocked(verificationStatus),
    banner: getFunderVerificationBannerContent({
      verificationStatus,
      hasSubmittedProfile: Boolean(profile?.submittedAt),
      reviewNote: rejectionNote,
    }),
  };
}

export function FunderVerificationBanner({ className = "", inline = false }: { className?: string; inline?: boolean }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { banner, verificationStatus } = useFunderVerificationState();
  const [dismissed, setDismissed] = useState(true);

  const status = verificationStatus ?? "NONE";

  useEffect(() => {
    if (!banner || typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(dismissKey(status)) === "1");
  }, [banner, status]);

  if (role === "ADMIN" || pathname.startsWith("/admin")) return null;
  if (!isFunderRole(role) || pathname.startsWith("/funders/verification")) return null;
  if (!banner) return null;
  if (dismissed && !inline) return null;

  const styles = VARIANT_STYLES[banner.variant];
  const Icon = styles.icon;

  const body = (
    <div className={`rounded-xl border px-4 py-3 ${styles.border} ${styles.bg} ${className}`} role="status" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.iconClass}`} aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className={`text-sm font-semibold ${styles.titleClass}`}>{banner.title}</p>
            <p className="text-xs leading-relaxed text-slate-300/90">{banner.body}</p>
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              <Lock className="h-3 w-3" aria-hidden />
              Investing locked until approved — finish when ready
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/funders/verification"
            className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-black hover:bg-orange-400"
          >
            {banner.ctaLabel}
          </Link>
          {!inline ? (
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem(dismissKey(status), "1");
                setDismissed(true);
              }}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"
              aria-label="Dismiss reminder"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (inline) return body;

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-black/55 backdrop-blur-sm" aria-hidden onClick={() => {
        window.localStorage.setItem(dismissKey(status), "1");
        setDismissed(true);
      }} />
      <div className="fixed inset-x-4 top-[12vh] z-[210] mx-auto max-w-lg md:inset-x-auto md:left-1/2 md:-translate-x-1/2">
        {body}
      </div>
    </>
  );
}
