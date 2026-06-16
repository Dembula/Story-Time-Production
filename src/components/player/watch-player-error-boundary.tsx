"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import { resolvePlaybackSources } from "@/lib/playback-sources";

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
    const source = resolvePlaybackSources(src);

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
          {source ? (
            <MediaPlayer
              className="h-full w-full rounded-lg bg-black [&_video]:object-contain"
              title={title}
              src={{ src: source.src, type: source.type as "application/x-mpegurl" | "video/mp4" }}
              poster={poster || undefined}
              playsInline
              autoPlay
              load="eager"
            >
              <MediaProvider />
              <DefaultVideoLayout icons={defaultLayoutIcons} />
            </MediaPlayer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-white/10 bg-black text-sm text-slate-400">
              Video unavailable.
            </div>
          )}
        </div>
      </div>
    );
  }
}
