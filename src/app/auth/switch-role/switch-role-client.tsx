"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { StoryTimeLoader } from "@/components/ui/storytime-loader";
import Link from "next/link";

const SESSION_UPDATE_TIMEOUT_MS = 2500;

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
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (error || !sessionPatch || !redirectUrl) return;
    if (didSwitchRef.current) return;
    didSwitchRef.current = true;

    void (async () => {
      const timeout = new Promise<void>((resolve) => {
        window.setTimeout(resolve, SESSION_UPDATE_TIMEOUT_MS);
      });
      try {
        // Never hang forever — session updates can stall; DB role is already switched.
        await Promise.race([Promise.resolve(update?.(sessionPatch)), timeout]);
      } catch {
        // Still navigate — cookie may already match, or hard load will refresh JWT.
      }
      try {
        window.location.assign(redirectUrl);
      } catch {
        setStuck(true);
      }
      // If navigation somehow doesn't unload the page, surface a continue link.
      window.setTimeout(() => setStuck(true), 4000);
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
      {stuck && redirectUrl ? (
        <Link
          href={redirectUrl}
          className="mt-6 text-sm text-orange-300 underline hover:text-orange-200"
        >
          Continue to {roleLabel?.toLowerCase() ?? "your"} profile
        </Link>
      ) : null}
    </div>
  );
}
