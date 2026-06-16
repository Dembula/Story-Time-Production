"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";
import { modalVariants } from "@/lib/motion/presets";

import {
  findActiveScene,
  formatSceneActorsLabel,
  parseSceneActors,
  type PlaybackScene,
} from "@/lib/player/scene-intelligence";

type Scene = PlaybackScene;

export type ScriptAnalysisInfo = {
  used?: boolean;
  sourceType?: string | null;
  truncated?: boolean;
  error?: string | null;
  label?: string | null;
};

function scriptSourceLabel(analysis: ScriptAnalysisInfo | null | undefined): string | null {
  if (!analysis?.used) return null;
  if (analysis.label?.trim()) return analysis.label.trim();
  switch (analysis.sourceType) {
    case "platform-version":
      return "Platform screenplay";
    case "linked-project":
      return "Linked production script";
    case "uploaded-document":
      return "Uploaded screenplay";
    case "project":
      return "Production breakdown";
    default:
      return "Script-backed";
  }
}

export function PlaybackMetadataPanel({
  open,
  onClose,
  moodTags,
  atmosphere,
  pacing,
  narrativeSummary,
  scriptAnalysis,
  sceneIntelligencePending,
  scenes,
  currentTime,
  onSeek,
}: {
  open: boolean;
  onClose: () => void;
  moodTags?: unknown;
  atmosphere?: string | null;
  pacing?: string | null;
  narrativeSummary?: string | null;
  scriptAnalysis?: ScriptAnalysisInfo | null;
  sceneIntelligencePending?: boolean;
  scenes: Scene[];
  currentTime: number;
  onSeek: (seconds: number) => void;
}) {
  const tags = Array.isArray(moodTags) ? (moodTags as string[]) : [];
  const activeScene = findActiveScene(scenes, currentTime);
  const activeActors = parseSceneActors(activeScene?.actors);
  const scriptLabel = scriptSourceLabel(scriptAnalysis);

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="playback-metadata"
          className="absolute right-0 top-14 z-30 flex h-[calc(100%-3.5rem)] w-full max-w-sm flex-col border-l border-white/10 bg-black/80 backdrop-blur-xl"
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
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {sceneIntelligencePending ? (
          <div className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
            Analyzing screenplay and building scene markers…
          </div>
        ) : null}

        {scriptLabel ? (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            {scriptLabel}
            {scriptAnalysis?.truncated ? " · excerpt analyzed" : ""}
          </div>
        ) : scriptAnalysis?.error ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Script file could not be read automatically; scene data is inferred from catalogue details.
          </div>
        ) : !sceneIntelligencePending && scenes.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
            No scene markers yet. Link a platform script or upload a screenplay, then run enrichment from the creator
            tools.
          </div>
        ) : null}

        {activeScene ? (
          <section className="rounded-xl border border-orange-400/30 bg-orange-500/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-200/80">Now playing</p>
            <p className="mt-1 text-sm font-medium text-white">{activeScene.summary ?? "Scene"}</p>
            {activeActors.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeActors.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-medium text-orange-100"
                  >
                    <Users className="h-3 w-3 opacity-70" />
                    {name}
                  </span>
                ))}
              </div>
            ) : null}
            {activeScene.mood ? (
              <p className="mt-2 text-[11px] text-orange-100/70">Mood: {activeScene.mood}</p>
            ) : null}
          </section>
        ) : null}

        {narrativeSummary?.trim() ? (
          <p className="text-xs leading-relaxed text-slate-300">{narrativeSummary.trim()}</p>
        ) : null}

        {atmosphere ? (
          <p className="text-xs text-slate-300">
            <span className="text-orange-300">Atmosphere:</span> {atmosphere}
            {pacing ? ` · ${pacing} pacing` : ""}
          </p>
        ) : null}

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {scenes.length > 0 ? (
          <ul className="space-y-2">
            {scenes.map((scene) => {
              const active = currentTime >= scene.startSeconds && currentTime < scene.endSeconds;
              const actorsLabel = formatSceneActorsLabel(scene.actors);
              const actorNames = parseSceneActors(scene.actors);
              return (
                <li key={scene.id}>
                  <button
                    type="button"
                    onClick={() => onSeek(scene.startSeconds)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                      active
                        ? "border-orange-400/40 bg-orange-500/10 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <p className="font-medium tabular-nums">{formatTime(scene.startSeconds)}</p>
                    <p className="mt-1 line-clamp-3 leading-snug">{scene.summary ?? "Scene"}</p>
                    {actorsLabel ? (
                      <p className="mt-1.5 text-[11px] font-medium text-orange-200/90">{actorsLabel}</p>
                    ) : actorNames.length > 0 ? (
                      <p className="mt-1.5 text-[10px] text-slate-500">{actorNames.join(", ")}</p>
                    ) : null}
                    {scene.mood ? <p className="mt-1 text-[10px] text-slate-500">{scene.mood}</p> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
