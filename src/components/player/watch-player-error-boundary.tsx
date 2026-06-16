"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";

type WatchPlayerErrorBoundaryProps = {
  src: string;
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
    const { poster, title, contentDetailUrl, children } = this.props;

    if (!hasError) return children;

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        <div className="flex items-center justify-between p-4">
          <h1 className="truncate text-sm font-medium text-white/90">{title}</h1>
          <Link
            href={contentDetailUrl}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-white/10"
          >
            Back
          </Link>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-lg font-medium text-white">Playback error</p>
          <p className="max-w-md text-sm text-slate-400">
            The player could not start. Reload the page or return to the title details and try again.
          </p>
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="max-h-40 rounded-lg opacity-40" />
          ) : null}
        </div>
      </div>
    );
  }
}
