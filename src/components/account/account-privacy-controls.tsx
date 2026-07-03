"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Download, Trash2 } from "lucide-react";

type AccountPrivacyControlsProps = {
  /** Visual variant for different dashboards. */
  variant?: "viewer" | "creator" | "marketplace";
  className?: string;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
};

/**
 * App Store / Play Store / GDPR-style account controls: export personal data and delete account.
 * Shared across viewer settings, creator account, and marketplace stakeholder profiles.
 */
export function AccountPrivacyControls({
  variant = "creator",
  className = "",
  onError,
  onSuccess,
}: AccountPrivacyControlsProps) {
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [exportingAccount, setExportingAccount] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");

  const reportError = (message: string) => {
    setLocalError(message);
    setLocalSuccess("");
    onError?.(message);
  };

  const reportSuccess = (message: string) => {
    setLocalSuccess(message);
    setLocalError("");
    onSuccess?.(message);
  };

  const shell =
    variant === "viewer"
      ? "rounded-2xl border border-red-500/25 bg-red-950/20 p-5 md:p-6 space-y-4"
      : "rounded-2xl border border-red-500/30 bg-red-950/15 p-5 md:p-6 space-y-4";

  const inputClass =
    variant === "viewer"
      ? "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-600"
      : "w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500";

  return (
    <section className={`${shell} ${className}`.trim()}>
      <div>
        <h2 className="text-lg font-semibold text-red-100">Privacy & account control</h2>
        <p className="mt-1 text-sm text-slate-400">
          Download a copy of your account data, or permanently delete your Story Time account. Deletion
          cannot be undone.
        </p>
      </div>

      {(localError || localSuccess) && !onError && !onSuccess ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            localError
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {localError || localSuccess}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={exportingAccount}
          onClick={async () => {
            setExportingAccount(true);
            setLocalError("");
            try {
              const res = await fetch("/api/account/export");
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error((j as { error?: string }).error || "Export failed");
              }
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `storytime-account-export-${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
              reportSuccess("Account data export downloaded.");
            } catch (e) {
              reportError(e instanceof Error ? e.message : "Export failed");
            } finally {
              setExportingAccount(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.08] disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exportingAccount ? "Preparing…" : "Download my data"}
        </button>
      </div>

      <div className="rounded-xl border border-red-500/30 bg-black/30 p-4 space-y-3">
        <p className="text-sm font-medium text-red-100">Delete account</p>
        <p className="text-xs text-slate-400">
          Type <span className="font-mono text-red-200">DELETE</span> to confirm. If you signed up with
          email and password, enter your password as well.
        </p>
        <input
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder="Type DELETE"
          className={inputClass}
          autoComplete="off"
        />
        <input
          type="password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          placeholder="Password (if you have one)"
          className={inputClass}
          autoComplete="current-password"
        />
        <button
          type="button"
          disabled={deletingAccount || deleteConfirm.trim().toUpperCase() !== "DELETE"}
          onClick={async () => {
            if (
              !window.confirm(
                "Permanently delete your Story Time account and associated personal data? This cannot be undone.",
              )
            ) {
              return;
            }
            setDeletingAccount(true);
            setLocalError("");
            try {
              const res = await fetch("/api/account/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  confirmation: deleteConfirm,
                  password: deletePassword || undefined,
                }),
              });
              const j = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error((j as { error?: string }).error || "Delete failed");
              await signOut({ callbackUrl: "/" });
            } catch (e) {
              reportError(e instanceof Error ? e.message : "Delete failed");
              setDeletingAccount(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {deletingAccount ? "Deleting…" : "Permanently delete account"}
        </button>
      </div>
    </section>
  );
}
