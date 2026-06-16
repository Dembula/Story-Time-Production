"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import { Play } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import { resolvePlaybackSources } from "@/lib/playback-sources";

type BtsVideo = {
  id: string;
  title: string;
  videoUrl: string | null;
  thumbnail: string | null;
};

export function BtsSection({ btsVideos }: { btsVideos: BtsVideo[] }) {
  const [playing, setPlaying] = useState<string | null>(null);

  if (!btsVideos?.length) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Behind the Scenes</h3>
        <p className="text-muted-foreground">No BTS content available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Behind the Scenes</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {btsVideos.map((bts) => {
          const source = resolvePlaybackSources(bts.videoUrl);
          return (
            <div
              key={bts.id}
              className="relative aspect-video rounded-lg overflow-hidden bg-muted group"
            >
              {playing === bts.id && source ? (
                <MediaPlayer
                  className="h-full w-full [&_video]:object-contain"
                  title={bts.title}
                  src={{ src: source.src, type: source.type as "application/x-mpegurl" | "video/mp4" }}
                  poster={bts.thumbnail || undefined}
                  playsInline
                  autoPlay
                  load="eager"
                  onEnded={() => setPlaying(null)}
                >
                  <MediaProvider />
                  <DefaultVideoLayout icons={defaultLayoutIcons} />
                </MediaPlayer>
              ) : (
                <>
                  {bts.thumbnail ? (
                    <Image
                      src={bts.thumbnail}
                      alt={bts.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      disabled={!source}
                      onClick={() => setPlaying(bts.id)}
                      className="p-4 rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Play className="w-8 h-8 fill-current" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-sm font-medium">{bts.title}</p>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
