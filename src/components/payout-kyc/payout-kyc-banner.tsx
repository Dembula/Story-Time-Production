"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, Lock, ShieldCheck, X } from "lucide-react";
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

function dismissKey(status: string) {
  return `storytime_payout_kyc_dismissed_${status}`;
}

/** Dismissible reminder — not a persistent layout banner. */
export function PayoutKycBanner({ className = "", inline = false }: { className?: string; inline?: boolean }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const needsKyc = requiresPayoutKyc(role) && !pathname.startsWith("/payout-verification");
  const [dismissed, setDismissed] = useState(true);

  const sessionStatus = (session?.user as { payoutKycVerificationStatus?: KycVerificationStatus })
    ?.payoutKycVerificationStatus;

  const { data: eligibility } = useQuery({
    queryKey: ["payout-kyc-eligibility", pathname, role],
    queryFn: async () => {
      const params = new URLSearchParams({ pathname });
      const res = await fetch(`/api/payout-kyc/eligibility?${params}`);
      return res.json() as Promise<{ showPrompt?: boolean; packagePaid?: boolean; onDashboard?: boolean }>;
    },
    enabled: needsKyc && !!session?.user,
    staleTime: 60_000,
  });

  const mayShowAfterCheckout = eligibility?.showPrompt === true;

  const { data } = useQuery({
    queryKey: ["payout-kyc-banner"],
    queryFn: async () => fetch("/api/payout-kyc/verification").then((r) => r.json()),
    enabled: needsKyc && !!session?.user && mayShowAfterCheckout,
    staleTime: 60_000,
  });

  const profile = data?.profile as
    | { verificationStatus?: KycVerificationStatus; reviewNote?: string | null; submittedAt?: string | null }
    | undefined;

  const status = profile?.verificationStatus ?? sessionStatus ?? "NONE";
  const content = getPayoutKycBannerContent({
    verificationStatus: profile?.verificationStatus ?? sessionStatus ?? null,
    hasSubmittedProfile: Boolean(profile?.submittedAt),
    reviewNote: profile?.reviewNote,
  });

  useEffect(() => {
    if (!content || typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(dismissKey(status)) === "1");
  }, [content, status]);

  if (!needsKyc || !mayShowAfterCheckout || !content) return null;
  if (dismissed && !inline) return null;

  const styles = VARIANT_STYLES[content.variant];
  const Icon = styles.icon;
  const walletHref = role === "CONTENT_CREATOR" ? "/creator/wallet" : "/wallet";

  const body = (
    <div className={`rounded-xl border px-4 py-3 ${styles.border} ${styles.bg} ${className}`} role="status" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.iconClass}`} aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className={`text-sm font-semibold ${styles.titleClass}`}>{content.title}</p>
            <p className="text-xs leading-relaxed text-slate-300/90">{content.body}</p>
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              <Lock className="h-3 w-3" aria-hidden />
              Payouts locked until approved — complete when ready
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/payout-verification"
            className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-black hover:bg-orange-400"
          >
            {content.ctaLabel}
          </Link>
          <Link href={walletHref} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.06]">
            Wallet
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
