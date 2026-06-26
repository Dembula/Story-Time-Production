"use client";

import { signOut } from "next-auth/react";
import { Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LogOutButtonProps = {
  label?: string;
  landingPath?: string;
  className?: string;
  showIcon?: boolean;
};

const defaultClassName =
  "inline-flex min-h-[2.5rem] min-w-[10.5rem] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition disabled:pointer-events-none disabled:opacity-80 [@media(hover:hover)]:hover:border-red-400/30 [@media(hover:hover)]:hover:bg-red-500/10 [@media(hover:hover)]:hover:text-red-300";

export function LogOutButton({
  label = "Log out",
  landingPath = "/",
  className = "",
  showIcon = true,
}: LogOutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogOut() {
    if (loading) return;
    setLoading(true);
    try {
      await signOut({ redirect: false });
      router.push(landingPath);
      router.refresh();
    } catch {
      setLoading(false);
    }
  }

  const buttonClass = className || defaultClassName;
  const loadingClass = loading
    ? `${buttonClass} border-white/10 bg-white/[0.04] text-slate-400`
    : buttonClass;

  return (
    <button
      type="button"
      onClick={() => void handleLogOut()}
      disabled={loading}
      aria-busy={loading}
      className={loadingClass}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span>Logging out…</span>
        </>
      ) : (
        <>
          {showIcon ? <LogOut className="h-4 w-4 shrink-0" aria-hidden /> : null}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
