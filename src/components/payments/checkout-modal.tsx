"use client";

import { useEffect } from "react";
import { ExternalLink, ShieldCheck, X } from "lucide-react";

type CheckoutModalProps = {
  open: boolean;
  checkoutUrl: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
};

export function CheckoutModal({
  open,
  checkoutUrl,
  title = "Secure checkout",
  subtitle = "Complete your payment securely, then return to continue.",
  onClose,
}: CheckoutModalProps) {
  useEffect(() => {
    if (!open || !checkoutUrl || typeof window === "undefined") return;
    const timeout = window.setTimeout(() => {
      window.location.assign(checkoutUrl);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [open, checkoutUrl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Storytime secure pay
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-slate-300 hover:bg-white/[0.08] hover:text-white"
            aria-label="Close checkout"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex h-[68vh] min-h-[460px] w-full items-center justify-center bg-slate-900 p-8">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
            <p className="text-base font-semibold text-white">Redirecting to secure bank checkout...</p>
            <p className="mt-2 text-sm text-slate-400">
              Do not close this window. You will be returned automatically after payment.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          >
            Open in a new secure tab <ExternalLink className="h-4 w-4" />
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/[0.08] hover:text-white"
            >
              Continue later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
