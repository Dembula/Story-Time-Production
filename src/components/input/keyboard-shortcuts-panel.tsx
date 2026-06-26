"use client";

import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getPlatformShortcutGroups } from "@/lib/input/keyboard-shortcuts";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function KeyboardShortcutsPanel({ open, onClose }: Props) {
  const { deviceClass, inputMode } = useAdaptiveUi();
  const isTv = deviceClass === "tv";
  const isRemote = inputMode === "remote";

  const shortcutGroups = getPlatformShortcutGroups();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close shortcuts"
            className="fixed inset-0 z-[2200] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            data-modal-open="true"
            className={`fixed z-[2201] overflow-y-auto rounded-2xl border border-white/12 bg-[#0c0c0e]/98 shadow-2xl backdrop-blur-2xl ${
              isTv
                ? "left-1/2 top-[8vh] max-h-[84vh] w-[min(720px,92vw)] -translate-x-1/2 p-8"
                : "inset-x-4 top-[10vh] mx-auto max-h-[80vh] max-w-lg p-6 sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2"
            }`}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="shortcuts-title" className={`font-display font-semibold text-white ${isTv ? "text-2xl" : "text-xl"}`}>
                  Keyboard & remote shortcuts
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Works on laptop, desktop, TV remotes, and connected gamepads.
                </p>
              </div>
              <button
                type="button"
                data-modal-close
                onClick={onClose}
                className={`rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white ${
                  isRemote ? "adaptive-interactive min-h-[44px] min-w-[44px] p-3" : "p-2"
                }`}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6">
              {shortcutGroups.map((group) => (
                <section key={group.title}>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-orange-300/90">
                    {group.title}
                  </h3>
                  <ul className="space-y-2">
                    {group.items.map((item) => (
                      <li
                        key={`${group.title}-${item.keys}`}
                        className="flex flex-col gap-1 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="text-sm text-slate-300">{item.description}</span>
                        <kbd className="inline-flex shrink-0 items-center rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-slate-200">
                          {item.keys}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
