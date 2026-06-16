"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";

type WatchPlayerErrorBoundaryProps = {
  fallbackSrc?: string | null;
  poster?: string | null;
  title: string;
  contentDetailUrl: string;
  children: ReactNode;
};

type WatchPlayerErrorBoundaryState = {
  hasError: boolean;
};

export class WatchPlayerErrorBoundary extends Component<
  WatchPlayerErrorBoundaryProps,
  WatchPlayerErrorBoundaryState
> {
  state: WatchPlayerErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WatchPlayerErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Watch player runtime error:", error);
  }

  render() {
    const { hasError } = this.state;
    const { fallbackSrc, poster, title, contentDetailUrl, children } = this.props;

    if (!hasError) return children;

    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-sm font-medium text-white/90 truncate">{title}</h1>
          <Link
            href={contentDetailUrl}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
          >
            Back
          </Link>
        </div>
        <div className="flex-1 p-4 pb-8">
          {fallbackSrc ? (
            <video
              src={fallbackSrc}
              poster={poster || undefined}
              controls
              playsInline
              autoPlay
              className="h-full w-full rounded-lg bg-black object-contain"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center">
              <p className="text-base font-medium text-white">Playback recovered safely</p>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                The protected player hit a runtime error, so the unsafe fallback stream was blocked. Go back and try playback again.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }
}
