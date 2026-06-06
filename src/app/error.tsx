"use client";

import { useEffect } from "react";
import Link from "next/link";

function isChunkLoadError(error: Error): boolean {
  const msg = error.message ?? "";
  return (
    error.name === "ChunkLoadError" ||
    msg.includes("Loading chunk") ||
    msg.includes("Failed to fetch dynamically imported module")
  );
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    console.error("App runtime error boundary:", error);
  }, [error]);

  useEffect(() => {
    if (!chunkError || typeof window === "undefined") return;
    const key = "storytime-chunk-retry";
    const retries = Number(sessionStorage.getItem(key) ?? "0");
    if (retries < 2) {
      sessionStorage.setItem(key, String(retries + 1));
      window.location.reload();
    } else {
      sessionStorage.removeItem(key);
    }
  }, [chunkError]);

  return (
    <div className="min-h-screen bg-black text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-panel">
        <h2 className="text-xl font-semibold">
          {chunkError ? "Update still loading" : "Something went wrong in this page"}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          {chunkError
            ? "The dev server was still compiling when the browser requested this page. Wait a moment, then reload — it should recover automatically."
            : "The browser hit an unexpected runtime error. Try reloading this view."}
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") sessionStorage.removeItem("storytime-chunk-retry");
              reset();
            }}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
          >
            Reload Page
          </button>
          <Link
            href="/"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/[0.05]"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
