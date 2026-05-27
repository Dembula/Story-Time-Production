"use client";

import { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useModoc } from "./use-modoc";
import { Bot, X, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { useMotion } from "@/components/motion/motion-provider";
import {
  viewerMessageVariants,
  viewerOverlayVariants,
  viewerSheetVariants,
} from "@/lib/motion/viewer-presets";

/** MODOC panel for the viewer (browse) dashboard: premium glass sheet with tuned motion. */
export function ModocViewerPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { messages, append, status, setRequestContext } = useModoc();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { deviceClass } = useAdaptiveUi();
  const { prefersReducedMotion } = useMotion();
  const isMobile = deviceClass === "mobile";

  useEffect(() => {
    setRequestContext({
      scope: "browse",
      clientContext:
        "Viewer dashboard. Help find movies by scene or title from the Story Time catalog; suggest titles based on watch history. Only suggest titles from the catalog you are given.",
    });
  }, [setRequestContext]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [messages, prefersReducedMotion]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("modoc-viewer-open");
    return () => root.classList.remove("modoc-viewer-open");
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    append({ role: "user", content: text });
    setInput("");
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-[1340] bg-black/62 backdrop-blur-xl"
            variants={viewerOverlayVariants()}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modoc-viewer-title"
            className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] top-[4.5rem] z-[1350] mx-auto flex w-auto max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[linear-gradient(145deg,rgba(10,16,28,0.92),rgba(7,11,20,0.88))] shadow-2xl backdrop-blur-2xl max-md:bottom-[max(0.5rem,env(safe-area-inset-bottom))] max-md:top-[4.5rem] md:inset-x-5 md:bottom-4 md:top-[5.5rem] lg:inset-x-8 lg:top-[6.5rem]"
            style={{ boxShadow: "0 18px 72px rgba(2, 6, 23, 0.75), inset 0 1px 0 rgba(255,255,255,0.08)" }}
            variants={viewerSheetVariants(isMobile)}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-4 md:px-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/20 via-sky-400/10 to-orange-400/20 shadow-lg md:h-14 md:w-14">
                    <Bot className="h-8 w-8 text-cyan-300" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-emerald-400/80 ring-2 ring-slate-900" />
                </div>
                <div>
                  <h2 id="modoc-viewer-title" className="text-lg font-semibold tracking-tight text-white md:text-xl">
                    AI assistant
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400 md:text-sm">
                    Find a movie by scene · Get suggestions from your watch history
                  </p>
                </div>
              </div>
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                className="viewer-motion-surface rounded-xl p-2.5 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </motion.button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_45%),linear-gradient(180deg,rgba(2,6,23,0.55),rgba(2,6,23,0.78))] px-4 py-4 md:space-y-6 md:px-6 md:py-5">
              {messages.length === 0 && (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center justify-center px-6 py-16 text-center"
                >
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
                    <Sparkles className="h-10 w-10 text-cyan-400/80" />
                  </div>
                  <p className="max-w-sm text-lg leading-relaxed text-slate-300">
                    Describe a scene or ask for a title — I’ll search the Story Time catalog.
                  </p>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    I can also suggest films based on what you’ve been watching.
                  </p>
                </motion.div>
              )}
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <motion.div
                    key={message.id}
                    layout={!prefersReducedMotion}
                    variants={viewerMessageVariants()}
                    initial={prefersReducedMotion ? false : "hidden"}
                    animate="visible"
                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-2xl px-4 py-3.5 md:max-w-[88%] md:px-5 md:py-4 ${
                        isUser
                          ? "border border-cyan-300/30 bg-gradient-to-br from-cyan-500/22 to-orange-500/18 text-white shadow-[0_8px_24px_rgba(14,116,144,0.2)]"
                          : "border border-white/10 bg-white/[0.04] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                        {message.parts?.map((part, i) => {
                          if (part.type === "text") {
                            const content = (part as { text?: string }).text ?? "";
                            const linkRegex = /\/browse\/content\/([a-z0-9]+)/gi;
                            const parts: React.ReactNode[] = [];
                            let lastIndex = 0;
                            let match: RegExpExecArray | null;
                            while ((match = linkRegex.exec(content)) !== null) {
                              parts.push(content.slice(lastIndex, match.index));
                              parts.push(
                                <Link
                                  key={i + match[0]}
                                  href={match[0]}
                                  className="viewer-motion-surface mt-1 inline-flex items-center gap-1 rounded-lg border border-cyan-400/35 bg-cyan-500/16 px-2.5 py-1 font-medium text-cyan-200 hover:bg-cyan-500/28"
                                  onClick={onClose}
                                >
                                  View this title →
                                </Link>
                              );
                              lastIndex = match.index + match[0].length;
                            }
                            parts.push(content.slice(lastIndex));
                            return <span key={i}>{parts}</span>;
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <AnimatePresence>
                {(status === "streaming" || status === "submitted") && (
                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: 4 }}
                    className="flex justify-start"
                  >
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 md:px-5 md:py-4">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:0ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:300ms]" />
                      </div>
                      <span className="text-sm text-slate-400">Generating…</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={handleSubmit}
              className="shrink-0 border-t border-white/10 bg-white/[0.03] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-5 md:pb-5"
            >
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe a scene or ask for a movie..."
                  className="viewer-motion-surface viewer-motion-glow flex-1 rounded-xl border border-white/12 bg-black/35 px-4 py-3.5 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 md:px-5 md:py-4 md:text-base"
                  disabled={status === "streaming" || status === "submitted"}
                />
                <motion.button
                  type="submit"
                  disabled={!input.trim() || status === "streaming" || status === "submitted"}
                  whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.02 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                  className="viewer-motion-surface rounded-xl bg-gradient-to-r from-cyan-500 to-orange-500 px-4 py-3.5 font-medium text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-orange-400 disabled:pointer-events-none disabled:opacity-50 md:px-6 md:py-4"
                >
                  <Send className="h-5 w-5" />
                </motion.button>
              </div>
            </form>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
