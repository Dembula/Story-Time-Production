"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, Lock, ShieldCheck, X } from "lucide-react";
import { getPayoutKycBannerContent, requiresPayoutKyc } from "@/lib/payout-kyc-shared";
import type { KycVerificationStatus } from "@/lib/payout-kyc-shared";

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

const LOGIN_STAMP_PREFIX = "storytime_payout_kyc_login_";
const DISMISS_PREFIX = "storytime_payout_kyc_dismissed_";

function isWalletPath(pathname: string) {
  return pathname.includes("/wallet");
}

function ensureLoginStamp(userId: string): string {
  if (typeof window === "undefined") return "ssr";
  const key = `${LOGIN_STAMP_PREFIX}${userId}`;
  let stamp = window.sessionStorage.getItem(key);
  if (!stamp) {
    stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(key, stamp);
  }
  return stamp;
}

function dismissStorageKey(userId: string, loginStamp: string, status: string) {
  return `${DISMISS_PREFIX}${userId}_${loginStamp}_${status}`;
}

function clearLoginStamp(userId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`${LOGIN_STAMP_PREFIX}${userId}`);
}

/**
 * KYC reminder for the Wallet & payouts page only.
 * Dismissible with X for the current sign-in; reappears on the next login session.
 */
export function PayoutKycBanner({ className = "", inline = false }: { className?: string; inline?: boolean }) {
  const pathname = usePathname();
  const { data: session, status: authStatus } = useSession();
  const role = session?.user?.role;
  const userId = session?.user?.id ?? "";
  const onWallet = isWalletPath(pathname);
  const needsKyc =
    requiresPayoutKyc(role) &&
    !pathname.startsWith("/payout-verification") &&
    session?.user?.payoutKycVerificationStatus !== "APPROVED";

  const [dismissed, setDismissed] = useState(false);
  const [loginStamp, setLoginStamp] = useState<string | null>(null);

  const sessionStatus = (session?.user as { payoutKycVerificationStatus?: KycVerificationStatus } | undefined)
    ?.payoutKycVerificationStatus;

  // New sign-in gets a fresh stamp; signed-out clears the previous stamp so the next login resurfaces the banner.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (authStatus === "unauthenticated") {
      // Clear stamps for any recent user keys is awkward; clear known current if present via lastUser
      const last = window.sessionStorage.getItem("storytime_payout_kyc_last_user");
      if (last) {
        clearLoginStamp(last);
        window.sessionStorage.removeItem("storytime_payout_kyc_last_user");
      }
      setLoginStamp(null);
      setDismissed(false);
      return;
    }
    if (authStatus === "authenticated" && userId) {
      window.sessionStorage.setItem("storytime_payout_kyc_last_user", userId);
      setLoginStamp(ensureLoginStamp(userId));
    }
  }, [authStatus, userId]);

  const { data: eligibility } = useQuery({
    queryKey: ["payout-kyc-eligibility", pathname, role],
    queryFn: async () => {
      const params = new URLSearchParams({ pathname });
      const res = await fetch(`/api/payout-kyc/eligibility?${params}`);
      return res.json() as Promise<{ showPrompt?: boolean; packagePaid?: boolean; onDashboard?: boolean }>;
    },
    // Only resolve eligibility on wallet for the unfinished-KYC reminder.
    enabled: needsKyc && !!session?.user && onWallet,
    staleTime: 60_000,
  });

  const mayShow = onWallet && (eligibility?.showPrompt === true || needsKyc);

  const { data } = useQuery({
    queryKey: ["payout-kyc-banner", userId],
    queryFn: async () => fetch("/api/payout-kyc/verification").then((r) => r.json()),
    enabled: needsKyc && !!session?.user && mayShow,
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

  const fallbackContent =
    !content && needsKyc
      ? getPayoutKycBannerContent({
          verificationStatus: null,
          hasSubmittedProfile: false,
          reviewNote: null,
        })
      : null;
  const bannerContent = content ?? fallbackContent;

  useEffect(() => {
    if (!bannerContent || !userId || !loginStamp || typeof window === "undefined") return;
    const key = dismissStorageKey(userId, loginStamp, status);
    setDismissed(window.sessionStorage.getItem(key) === "1");
  }, [bannerContent, userId, loginStamp, status]);

  function dismiss() {
    if (!userId || !loginStamp) {
      setDismissed(true);
      return;
    }
    window.sessionStorage.setItem(dismissStorageKey(userId, loginStamp, status), "1");
    setDismissed(true);
  }

  // Wallet-only surface — never Command Centre / My Account / other pages.
  if (!onWallet || !needsKyc || !bannerContent || !mayShow) return null;
  if (dismissed) return null;
  if (sessionStatus === "APPROVED") return null;

  const styles = VARIANT_STYLES[bannerContent.variant];
  const Icon = styles.icon;

  const body = (
    <div className={`rounded-xl border px-4 py-3 ${styles.border} ${styles.bg} ${className}`} role="status" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.iconClass}`} aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className={`text-sm font-semibold ${styles.titleClass}`}>{bannerContent.title}</p>
            <p className="text-xs leading-relaxed text-slate-300/90">{bannerContent.body}</p>
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
            {bannerContent.ctaLabel}
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"
            aria-label="Dismiss reminder"
            title="Dismiss for this sign-in"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  // Inline only — wallet mounts this as a page section. No global overlay for wallet reminder.
  if (inline) return body;
  return null;
}
