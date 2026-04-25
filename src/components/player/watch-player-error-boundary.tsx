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
    const { src, poster, title, contentDetailUrl, children } = this.props;

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
          <video
            src={src}
            poster={poster || undefined}
            controls
            playsInline
            autoPlay
            className="h-full w-full rounded-lg bg-black object-contain"
          />
        </div>
      </div>
    );
  }
}
