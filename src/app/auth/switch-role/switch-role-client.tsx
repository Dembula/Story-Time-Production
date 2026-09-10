"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { StoryTimeLoader } from "@/components/ui/storytime-loader";
import Link from "next/link";

export function SwitchRoleClient({
  sessionPatch,
  redirectUrl,
  roleLabel,
  error,
  callbackUrl,
}: {
  sessionPatch?: {
    role: string;
    roles: string[];
    portalScope: "VIEWER" | "CREATOR" | "ADMIN";
    funderVerificationStatus?: string;
    payoutKycVerificationStatus?: string;
    adminRights?: unknown;
  };
  redirectUrl?: string;
  roleLabel?: string;
  error?: string;
  callbackUrl?: string | null;
}) {
  const { update } = useSession();
  const didSwitchRef = useRef(false);

  useEffect(() => {
    if (error || !sessionPatch || !redirectUrl) return;
    if (didSwitchRef.current) return;
    didSwitchRef.current = true;

    void (async () => {
      try {
        await update?.(sessionPatch);
      } catch {
        // Still navigate — cookie may already match server switch from the page render.
      }
      // Hard navigation so middleware sees the updated JWT cookie immediately.
      window.location.assign(redirectUrl);
    })();
  }, [error, redirectUrl, sessionPatch, update]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-slate-200">
          <p className="text-sm">{error}</p>
          <div className="mt-4 flex justify-center gap-3 text-sm">
            <Link href={callbackUrl ?? "/"} className="text-orange-300 hover:text-orange-200">
              Continue
            </Link>
            <Link href="/auth/creator/signin" className="text-slate-400 hover:text-white">
              Sign in again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-300">
      <StoryTimeLoader size="sm" hideTrack />
      <p className="mt-4 text-sm">Switching to {roleLabel?.toLowerCase()} profile…</p>
    </div>
  );
}
