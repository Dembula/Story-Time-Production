"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  };
  redirectUrl?: string;
  roleLabel?: string;
  error?: string;
  callbackUrl?: string | null;
}) {
  const router = useRouter();
  const { update } = useSession();

  useEffect(() => {
    if (error || !sessionPatch || !redirectUrl) return;
    let cancelled = false;
    void (async () => {
      await update?.(sessionPatch);
      if (!cancelled) {
        router.replace(redirectUrl);
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [error, redirectUrl, router, sessionPatch, update]);

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
