"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";

type ProfilePinModalProps = {
  open: boolean;
  profileName: string;
  title?: string;
  submitLabel?: string;
  loading?: boolean;
  error?: string;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
};

export function ProfilePinModal({
  open,
  profileName,
  title = "Enter profile PIN",
  submitLabel = "Continue",
  loading = false,
  error = "",
  onSubmit,
  onCancel,
}: ProfilePinModalProps) {
  const [pin, setPin] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setPin("");
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-labelledby="profile-pin-title"
        className="w-full max-w-md rounded-2xl border border-white/12 bg-black p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-500/10">
            <Lock className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h2 id="profile-pin-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            <p className="text-sm text-slate-400">{profileName}</p>
          </div>
        </div>

        <label className="mb-1 block text-xs text-slate-400">4-digit PIN</label>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && pin.length === 4 && !loading) onSubmit(pin);
          }}
          className="storytime-input w-full px-3 py-2.5 text-center text-lg tracking-[0.4em]"
          placeholder="••••"
        />

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pin.length !== 4 || loading}
            onClick={() => onSubmit(pin)}
            className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-orange-400 disabled:opacity-50"
          >
            {loading ? "Checking…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
