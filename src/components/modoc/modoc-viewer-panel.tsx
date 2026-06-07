"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useModoc } from "./use-modoc";
import { Bot, X, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { useMotion } from "@/components/motion/motion-provider";
import { viewerMessageVariants } from "@/lib/motion/viewer-presets";

/** Full-screen MODOC for the viewer browse experience. */
export function ModocViewerPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { messages, append, status, setRequestContext } = useModoc();
  const [input, setInput] = useState("");
  const [mounted, setMounted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { deviceClass } = useAdaptiveUi();
  const { prefersReducedMotion } = useMotion();
  const isMobile = deviceClass === "mobile";

  useEffect(() => setMounted(true), []);

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    append({ role: "user", content: text });
    setInput("");
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modoc-viewer-title"
          className="fixed inset-0 z-[2000] flex flex-col bg-black"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.07),transparent_42%),radial-gradient(circle_at_80%_100%,rgba(251,146,60,0.06),transparent_38%)]"
            aria-hidden
          />

          <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/8 bg-black/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl md:px-8 md:pb-4 md:pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/15 via-transparent to-orange-400/15 md:h-12 md:w-12">
                <Bot className="h-6 w-6 text-cyan-300 md:h-7 md:w-7" />
              </div>
              <div className="min-w-0">
                <h2 id="modoc-viewer-title" className="truncate text-base font-semibold tracking-tight text-white md:text-xl">
                  MODOC
                </h2>
                <p className="truncate text-[11px] text-slate-400 md:text-sm">
                  Find titles · Scene search · Watch-history picks
                </p>
              </div>
            </div>
            <motion.button
              type="button"
              onClick={onClose}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
              className="viewer-motion-surface shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-slate-300 hover:bg-white/[0.08] hover:text-white"
              aria-label="Close MODOC"
            >
              <X className="h-5 w-5 md:h-6 md:w-6" />
            </motion.button>
          </header>

          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
            <div className="mx-auto flex min-h-full max-w-3xl flex-col space-y-4 md:space-y-5">
              {messages.length === 0 && (
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center md:py-20"
                >
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 md:h-20 md:w-20">
                    <Sparkles className="h-8 w-8 text-cyan-400/85 md:h-10 md:w-10" />
                  </div>
                  <p className="max-w-md text-lg leading-relaxed text-slate-200 md:text-xl">
                    Describe a scene or ask for a title — I&apos;ll search the Story Time catalog.
                  </p>
                  <p className="mt-3 max-w-sm text-sm text-slate-500">
                    I can also suggest films based on what you&apos;ve been watching.
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
                      className={`max-w-[92%] rounded-2xl px-4 py-3 md:max-w-[85%] md:px-5 md:py-3.5 ${
                        isUser
                          ? "border border-orange-400/25 bg-orange-500/12 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                          : "border border-white/10 bg-white/[0.04] text-slate-100"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed md:text-base">
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
                                  className="viewer-motion-surface mt-1 inline-flex items-center gap-1 rounded-lg border border-cyan-400/35 bg-cyan-500/14 px-2.5 py-1 text-sm font-medium text-cyan-200 hover:bg-cyan-500/24"
                                  onClick={onClose}
                                >
                                  View this title →
                                </Link>,
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
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
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
          </div>

          <form
            onSubmit={handleSubmit}
            className="relative z-10 shrink-0 border-t border-white/8 bg-black/90 px-4 py-3 backdrop-blur-xl md:px-8 md:py-4"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto flex max-w-3xl gap-2 md:gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe a scene or ask for a movie..."
                className="viewer-motion-surface viewer-motion-glow min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/45 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 md:py-3.5 md:text-base"
                disabled={status === "streaming" || status === "submitted"}
                autoFocus={!isMobile}
              />
              <motion.button
                type="submit"
                disabled={!input.trim() || status === "streaming" || status === "submitted"}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                className="viewer-btn-primary flex shrink-0 items-center justify-center rounded-xl px-4 py-3 md:px-5 md:py-3.5"
              >
                <Send className="h-5 w-5" />
              </motion.button>
            </div>
          </form>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
