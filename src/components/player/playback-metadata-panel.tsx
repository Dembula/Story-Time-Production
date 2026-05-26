"use client";

import { motion } from "framer-motion";
import { modalVariants } from "@/lib/motion/presets";

type Scene = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  summary: string | null;
  mood: string | null;
  actors: unknown;
};

export function PlaybackMetadataPanel({
  open,
  onClose,
  moodTags,
  atmosphere,
  scenes,
  currentTime,
  onSeek,
}: {
  open: boolean;
  onClose: () => void;
  moodTags?: unknown;
  atmosphere?: string | null;
  scenes: Scene[];
  currentTime: number;
  onSeek: (seconds: number) => void;
}) {
  if (!open) return null;

  const tags = Array.isArray(moodTags) ? (moodTags as string[]) : [];

  return (
    <motion.aside
      className="absolute right-0 top-14 z-30 flex h-[calc(100%-3.5rem)] w-full max-w-sm flex-col border-l border-white/10 bg-black/75 backdrop-blur-xl"
      variants={modalVariants()}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Scene intelligence</h2>
        <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-white">
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {atmosphere && (
          <p className="text-xs text-slate-300">
            <span className="text-orange-300">Atmosphere:</span> {atmosphere}
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
                {t}
              </span>
            ))}
          </div>
        )}
        <ul className="space-y-2">
          {scenes.map((scene) => {
            const active = currentTime >= scene.startSeconds && currentTime < scene.endSeconds;
            const actors = Array.isArray(scene.actors) ? (scene.actors as string[]).join(", ") : "";
            return (
              <li key={scene.id}>
                <button
                  type="button"
                  onClick={() => onSeek(scene.startSeconds)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                    active
                      ? "border-orange-400/40 bg-orange-500/10 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <p className="font-medium">{formatTime(scene.startSeconds)}</p>
                  <p className="mt-0.5 line-clamp-2">{scene.summary ?? "Scene"}</p>
                  {actors && <p className="mt-1 text-[10px] text-slate-500">{actors}</p>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </motion.aside>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
