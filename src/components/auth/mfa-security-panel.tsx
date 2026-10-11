"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";

type MfaStatus = {
  enabled: boolean;
  pendingSetup: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  email: string | null;
};

type Variant = "dark" | "light" | "admin";

const shell: Record<Variant, string> = {
  dark: "rounded-xl border border-slate-700/50 bg-slate-900/40 p-5",
  light: "rounded-xl border border-slate-200 bg-white p-5 text-slate-950",
  admin: "rounded-xl border border-slate-700/50 bg-slate-900/50 p-5",
};

const muted: Record<Variant, string> = {
  dark: "text-slate-400",
  light: "text-slate-600",
  admin: "text-slate-400",
};

const inputCls: Record<Variant, string> = {
  dark: "w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white",
  light: "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-950",
  admin: "w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white",
};

export function MfaSecurityPanel({
  variant = "dark",
  className = "",
  onChanged,
}: {
  variant?: Variant;
  className?: string;
  onChanged?: (enabled: boolean) => void;
}) {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  // Keep callback out of load() deps — unstable inline onChanged caused infinite reload loops.
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);
  const lastEnabledRef = useRef<boolean | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/status", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as MfaStatus & { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load MFA status.");
      setStatus(data);
      const enabled = Boolean(data.enabled);
      // Skip the first status snapshot — only notify parents on real enable/disable flips.
      if (lastEnabledRef.current !== null && lastEnabledRef.current !== enabled) {
        onChangedRef.current?.(enabled);
      }
      lastEnabledRef.current = enabled;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load MFA status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startSetup() {
    setBusy(true);
    setError("");
    setInfo("");
    setRecoveryCodes(null);
    try {
      const res = await fetch("/api/auth/mfa/setup/start", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        qrDataUrl?: string;
        secret?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not start MFA setup.");
      setQrDataUrl(data.qrDataUrl ?? null);
      setManualSecret(data.secret ?? null);
      setConfirmCode("");
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start MFA setup.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelSetup() {
    setBusy(true);
    setError("");
    try {
      await fetch("/api/auth/mfa/setup/cancel", { method: "POST" });
      setQrDataUrl(null);
      setManualSecret(null);
      setConfirmCode("");
      await load({ silent: true });
    } catch {
      setError("Could not cancel setup.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/mfa/setup/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: confirmCode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        recoveryCodes?: string[];
      };
      if (!res.ok) throw new Error(data.error || "Could not confirm MFA.");
      setRecoveryCodes(data.recoveryCodes ?? []);
      setQrDataUrl(null);
      setManualSecret(null);
      setConfirmCode("");
      setInfo("Authenticator MFA is now on for this account (every portal that uses this email).");
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm MFA.");
    } finally {
      setBusy(false);
    }
  }

  async function disableMfa(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not disable MFA.");
      setDisablePassword("");
      setDisableCode("");
      setShowDisable(false);
      setRecoveryCodes(null);
      setInfo("Authenticator MFA has been turned off for this account.");
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disable MFA.");
    } finally {
      setBusy(false);
    }
  }

  const titleCls = variant === "light" ? "text-slate-950" : "text-white";

  // Only block the panel on the first load — refreshes stay interactive.
  if (loading && !status && !error) {
    return (
      <div className={`${shell[variant]} ${className}`}>
        <div className={`flex items-center gap-2 text-sm ${muted[variant]}`}>
          <Loader2 className="h-4 w-4 animate-spin" /> Loading authenticator MFA…
        </div>
      </div>
    );
  }

  return (
    <div className={`${shell[variant]} ${className}`}>
      <div className="mb-3 flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-orange-500/15 p-2 text-orange-400">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h3 className={`text-base font-semibold ${titleCls}`}>Authenticator MFA (2FA)</h3>
          <p className={`mt-1 text-sm ${muted[variant]}`}>
            Account-level protection: once enabled, every sign-in for this email (creator, stakeholder,
            viewer, and admin) asks for a code from your authenticator app. It is never required until you
            finish setup.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-3 space-y-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20"
          >
            Retry
          </button>
        </div>
      ) : null}
      {info ? (
        <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {info}
        </div>
      ) : null}

      {status?.enabled ? (
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400">
            <ShieldCheck className="h-4 w-4" /> Enabled
            {status.enabledAt
              ? ` · since ${new Date(status.enabledAt).toLocaleDateString()}`
              : ""}
          </p>
          <p className={`text-xs ${muted[variant]}`}>
            Recovery codes remaining: {status.recoveryCodesRemaining}
          </p>
          {!showDisable ? (
            <button
              type="button"
              onClick={() => setShowDisable(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20"
            >
              <ShieldOff className="h-4 w-4" /> Turn off MFA
            </button>
          ) : (
            <form onSubmit={disableMfa} className="space-y-3 rounded-lg border border-slate-700/60 p-3">
              <p className={`text-xs ${muted[variant]}`}>
                Confirm with your password and a current authenticator or recovery code.
              </p>
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
                required
                className={inputCls[variant]}
              />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="6-digit code or recovery code"
                required
                className={inputCls[variant]}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-red-500/20 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                >
                  {busy ? "Turning off…" : "Confirm turn off"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisable(false)}
                  className={`rounded-lg px-3 py-2 text-sm ${muted[variant]}`}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="inline-flex items-center gap-2 text-sm text-amber-300/90">
            <ShieldOff className="h-4 w-4" /> Not enabled
          </p>

          {!qrDataUrl && !status?.pendingSetup ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void startSetup()}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Set up authenticator app
            </button>
          ) : null}

          {(qrDataUrl || status?.pendingSetup) && (
            <div className="space-y-3">
              {!qrDataUrl ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startSetup()}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50"
                >
                  Continue setup — show QR again
                </button>
              ) : (
                <>
                  <p className={`text-sm ${muted[variant]}`}>
                    1. Open Google Authenticator, Authy, or 1Password → add account → scan this QR (or enter
                    the key manually).
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="MFA QR code"
                    className="h-[180px] w-[180px] rounded-lg border border-slate-600 bg-white p-2"
                  />
                  {manualSecret ? (
                    <p className={`break-all font-mono text-xs ${muted[variant]}`}>
                      Manual key: {manualSecret}
                    </p>
                  ) : null}
                </>
              )}

              <form onSubmit={confirmSetup} className="space-y-3">
                <p className={`text-sm ${muted[variant]}`}>
                  2. Enter the 6-digit code from the app to activate MFA.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="123456"
                  required
                  className={inputCls[variant]}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    {busy ? "Confirming…" : "Confirm & enable"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void cancelSetup()}
                    className={`rounded-lg px-3 py-2 text-sm ${muted[variant]}`}
                  >
                    Cancel setup
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {recoveryCodes && recoveryCodes.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="mb-2 text-sm font-medium text-amber-200">
            Save these recovery codes now — they are shown once.
          </p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-xs text-amber-100">
            {recoveryCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
