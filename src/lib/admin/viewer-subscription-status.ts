import {
  isExpiredTrialSubscription,
  isViewerSubscriptionExpired,
  subscriptionNeedsReactivation,
} from "@/lib/viewer-access";
import { VIEWER_PLAN_CONFIG } from "@/lib/pricing";

export type AdminViewerSubscriptionSnapshot = {
  plan: string;
  status: string;
  viewerModel: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  lastPaymentStatus: string | null;
  lastPaymentError: string | null;
  pastDueSince: string | null;
};

export type AdminSubscriptionStatusLabel = {
  label: string;
  detail: string;
  tone: "emerald" | "cyan" | "amber" | "red" | "slate" | "violet";
};

const PLAN_LABELS: Record<string, string> = {
  BASE_1: VIEWER_PLAN_CONFIG.BASE_1.label,
  STANDARD_3: VIEWER_PLAN_CONFIG.STANDARD_3.label,
  FAMILY_5: VIEWER_PLAN_CONFIG.FAMILY_5.label,
  PPV_FILM: "Pay per view",
};

export function describeAdminViewerSubscription(
  sub: AdminViewerSubscriptionSnapshot | null | undefined,
): AdminSubscriptionStatusLabel {
  if (!sub) {
    return { label: "No subscription", detail: "No viewer billing record", tone: "slate" };
  }

  const planLabel = PLAN_LABELS[sub.plan] ?? sub.plan;
  const model = sub.viewerModel === "PPV" ? "PPV" : "Subscription";

  if (sub.viewerModel === "PPV") {
    if (sub.status === "PAST_DUE" || sub.status === "CANCELLED") {
      return { label: "PPV inactive", detail: `${planLabel} · ${sub.status}`, tone: "red" };
    }
    return { label: "PPV active", detail: planLabel, tone: "violet" };
  }

  if (sub.status === "PAST_DUE") {
    return {
      label: "Payment past due",
      detail: `${planLabel}${sub.lastPaymentError ? ` · ${sub.lastPaymentError}` : ""}`,
      tone: "red",
    };
  }

  if (isExpiredTrialSubscription(sub)) {
    return {
      label: "Trial ended",
      detail: `${planLabel} · trial ended ${sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString() : ""}`,
      tone: "amber",
    };
  }

  if (sub.status === "TRIAL_ACTIVE") {
    return {
      label: "On trial",
      detail: `${planLabel} · ends ${sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString() : "soon"}`,
      tone: "cyan",
    };
  }

  if (sub.status === "CANCELLED") {
    return { label: "Cancelled", detail: planLabel, tone: "red" };
  }

  if (sub.status === "ACTIVE" && isViewerSubscriptionExpired(sub)) {
    return {
      label: "Lapsed",
      detail: `${planLabel} · period ended`,
      tone: "amber",
    };
  }

  if (subscriptionNeedsReactivation(sub)) {
    return { label: "Needs payment", detail: planLabel, tone: "amber" };
  }

  if (sub.cancelAtPeriodEnd) {
    return {
      label: "Active · cancelling",
      detail: `${planLabel} · until ${sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "period end"}`,
      tone: "amber",
    };
  }

  if (sub.status === "ACTIVE") {
    return {
      label: "Active",
      detail: `${planLabel} · renews ${sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "monthly"}`,
      tone: "emerald",
    };
  }

  return { label: sub.status.replace(/_/g, " "), detail: `${model} · ${planLabel}`, tone: "slate" };
}

export function subscriptionStatusBadgeClass(tone: AdminSubscriptionStatusLabel["tone"]): string {
  const map: Record<AdminSubscriptionStatusLabel["tone"], string> = {
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    cyan: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
    amber: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    red: "bg-red-500/15 text-red-300 border-red-500/30",
    slate: "bg-slate-700/50 text-slate-300 border-slate-600/40",
    violet: "bg-violet-500/15 text-violet-200 border-violet-500/30",
  };
  return map[tone];
}

type TrialSignupLike = {
  status: string;
  trialEndsAt?: Date | string | null;
  lastPaymentStatus?: string | null;
  createdAt?: Date | string | null;
};

/** True only when status is TRIAL_ACTIVE and the trial end timestamp is still in the future. */
export function isTrialCurrentlyActive(sub: TrialSignupLike): boolean {
  if (sub.status !== "TRIAL_ACTIVE") return false;
  if (!sub.trialEndsAt) return true;
  return new Date(sub.trialEndsAt) > new Date();
}

export type AdminTrialSignupLabel = {
  statusLabel: string;
  statusTone: "cyan" | "amber" | "emerald" | "red" | "slate";
  billingLabel: string;
  trialEndLabel: string;
  countsAsActive: boolean;
};

function formatTrialEndPhrase(trialEndsAt: Date | string | null | undefined, now = new Date()): string {
  if (!trialEndsAt) return "Trial end date not set";
  const end = new Date(trialEndsAt);
  if (Number.isNaN(end.getTime())) return "Trial end date invalid";

  const dateStr = end.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const diffMs = end.getTime() - now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (diffMs > 0) {
    const daysLeft = Math.ceil(diffMs / dayMs);
    return daysLeft === 1 ? `Ends ${dateStr} (tomorrow)` : `Ends ${dateStr} (in ${daysLeft} days)`;
  }

  const daysAgo = Math.ceil(Math.abs(diffMs) / dayMs);
  return daysAgo === 0
    ? `Ended ${dateStr} (today — status may still show TRIAL_ACTIVE until billing runs)`
    : `Ended ${dateStr} (${daysAgo} day${daysAgo === 1 ? "" : "s"} ago — awaiting billing update)`;
}

/** Admin payments dashboard row — separates real active trials from stale TRIAL_ACTIVE rows. */
export function describeAdminTrialSignup(sub: TrialSignupLike & { createdAt?: Date | string | null }): AdminTrialSignupLabel {
  const trialEndLabel = formatTrialEndPhrase(sub.trialEndsAt);
  const converted = sub.lastPaymentStatus === "SUCCEEDED";

  if (converted && sub.status === "ACTIVE") {
    return {
      statusLabel: "Converted",
      statusTone: "emerald",
      billingLabel: "First payment received",
      trialEndLabel,
      countsAsActive: false,
    };
  }

  if (isTrialCurrentlyActive(sub)) {
    return {
      statusLabel: "Trial active",
      statusTone: "cyan",
      billingLabel: "Not billed yet",
      trialEndLabel,
      countsAsActive: true,
    };
  }

  if (sub.status === "TRIAL_ACTIVE" && sub.trialEndsAt && new Date(sub.trialEndsAt) <= new Date()) {
    return {
      statusLabel: "Trial ended",
      statusTone: "amber",
      billingLabel: "Awaiting payment or status update",
      trialEndLabel,
      countsAsActive: false,
    };
  }

  if (sub.status === "PAST_DUE" && sub.trialEndsAt) {
    return {
      statusLabel: "Trial ended · unpaid",
      statusTone: "red",
      billingLabel: "Payment required",
      trialEndLabel,
      countsAsActive: false,
    };
  }

  if (sub.status === "CANCELLED") {
    return {
      statusLabel: "Cancelled",
      statusTone: "slate",
      billingLabel: converted ? "Had converted earlier" : "Never converted",
      trialEndLabel,
      countsAsActive: false,
    };
  }

  return {
    statusLabel: sub.status.replace(/_/g, " "),
    statusTone: "slate",
    billingLabel: converted ? "Converted" : "Trial history",
    trialEndLabel,
    countsAsActive: false,
  };
}

export function trialStatusBadgeClass(tone: AdminTrialSignupLabel["statusTone"]): string {
  const map: Record<AdminTrialSignupLabel["statusTone"], string> = {
    cyan: "bg-cyan-500/10 text-cyan-200",
    amber: "bg-amber-500/10 text-amber-200",
    emerald: "bg-emerald-500/10 text-emerald-300",
    red: "bg-red-500/10 text-red-300",
    slate: "bg-slate-700/50 text-slate-300",
  };
  return map[tone];
}
