"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global app error boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-panel">
          <h2 className="text-xl font-semibold">App crashed unexpectedly</h2>
          <p className="mt-2 text-sm text-slate-300">
            A fatal browser/runtime error occurred. Try a full reload.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
            >
              Retry
            </button>
            <Link
              href="/"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/[0.05]"
            >
              Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
