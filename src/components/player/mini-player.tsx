"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { usePlaybackSession } from "@/lib/playback/session-store";
import { modalVariants } from "@/lib/motion/presets";

export function MiniPlayer() {
  const mini = usePlaybackSession((s) => s.miniPlayer);
  const clear = usePlaybackSession((s) => s.clearMiniPlayer);

  return (
    <AnimatePresence>
      {mini && (
        <motion.div
          className="fixed bottom-4 right-4 z-[60] w-72 overflow-hidden rounded-2xl border border-white/15 bg-black/90 shadow-2xl backdrop-blur-xl"
          variants={modalVariants()}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <p className="truncate text-xs font-semibold text-white">{mini.title}</p>
            <button type="button" onClick={clear} className="text-slate-400 hover:text-white" aria-label="Close mini player">
              <X className="h-4 w-4" />
            </button>
          </div>
          <Link
            href={`/browse/content/${mini.contentId}/watch`}
            className="block px-3 py-3 text-xs text-orange-300 hover:text-orange-200"
          >
            Resume watching →
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
