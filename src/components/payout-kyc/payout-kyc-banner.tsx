"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Lock, ShieldCheck } from "lucide-react";
import { getPayoutKycBannerContent, requiresPayoutKyc } from "@/lib/payout-kyc";
import type { KycVerificationStatus } from "@/lib/payout-kyc";

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

export function PayoutKycBanner({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const needsKyc = requiresPayoutKyc(role) && !pathname.startsWith("/payout-verification");

  const sessionStatus = (session?.user as { payoutKycVerificationStatus?: KycVerificationStatus })
    ?.payoutKycVerificationStatus;

  const { data } = useQuery({
    queryKey: ["payout-kyc-banner"],
    queryFn: async () => fetch("/api/payout-kyc/verification").then((r) => r.json()),
    enabled: needsKyc && !!session?.user,
    staleTime: 60_000,
  });

  if (!needsKyc) {
    return null;
  }

  const profile = data?.profile as
    | { verificationStatus?: KycVerificationStatus; reviewNote?: string | null; submittedAt?: string | null }
    | undefined;

  const content = getPayoutKycBannerContent({
    verificationStatus: profile?.verificationStatus ?? sessionStatus ?? null,
    hasSubmittedProfile: Boolean(profile?.submittedAt),
    reviewNote: profile?.reviewNote,
  });

  if (!content) return null;

  const styles = VARIANT_STYLES[content.variant];
  const Icon = styles.icon;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${styles.border} ${styles.bg} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.iconClass}`} aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className={`text-sm font-semibold ${styles.titleClass}`}>{content.title}</p>
            <p className="text-xs leading-relaxed text-slate-300/90">{content.body}</p>
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              <Lock className="h-3 w-3" aria-hidden />
              Payouts locked until approved
            </p>
          </div>
        </div>
        <Link
          href="/payout-verification"
          className="shrink-0 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-black hover:bg-orange-400"
        >
          {content.ctaLabel}
        </Link>
      </div>
    </div>
  );
}
