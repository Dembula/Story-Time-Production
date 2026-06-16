"use client";

import { motion, AnimatePresence } from "framer-motion";
import { PictureInPicture2, SkipForward, Sparkles } from "lucide-react";
import { fadeOverlayVariants } from "@/lib/motion/presets";

type PlaybackChromeProps = {
  visible: boolean;
  title: string;
  showSkipIntro: boolean;
  onSkipIntro: () => void;
  onPiP: () => void;
  pipSupported: boolean;
  metadataOpen: boolean;
  onToggleMetadata: () => void;
  metadataAvailable?: boolean;
  currentSceneLabel?: string | null;
};

export function PlaybackChrome({
  visible,
  title,
  showSkipIntro,
  onSkipIntro,
  onPiP,
  pipSupported,
  metadataOpen,
  onToggleMetadata,
  metadataAvailable = true,
  currentSceneLabel,
}: PlaybackChromeProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent pb-28 pt-16"
          variants={fadeOverlayVariants()}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 px-4 md:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{title}</p>
              {currentSceneLabel && (
                <p className="truncate text-xs text-orange-200/90">{currentSceneLabel}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {showSkipIntro && (
                <button
                  type="button"
                  onClick={onSkipIntro}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/10"
                >
                  <SkipForward className="h-3.5 w-3.5" /> Skip intro
                </button>
              )}
              {metadataAvailable ? (
                <button
                  type="button"
                  onClick={onToggleMetadata}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold backdrop-blur-md ${
                    metadataOpen
                      ? "border-orange-400/40 bg-orange-500/20 text-orange-100"
                      : "border-white/15 bg-black/50 text-white hover:bg-white/10"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Scene info
                </button>
              ) : null}
              {pipSupported && (
                <button
                  type="button"
                  onClick={onPiP}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/10"
                  aria-label="Picture in picture"
                >
                  <PictureInPicture2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
