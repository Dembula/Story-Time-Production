"use client";

import { useEffect, useState, useRef } from "react";
import { useModoc } from "./use-modoc";
import { Bot, X, Send, Sparkles } from "lucide-react";
import Link from "next/link";

/** MODOC panel for the viewer (browse) dashboard: futuristic, large, easy to read. */
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

  useEffect(() => {
    setRequestContext({
      scope: "browse",
      clientContext:
        "Viewer dashboard. Help find movies by scene or title from the Story Time catalog; suggest titles based on watch history. Only suggest titles from the catalog you are given.",
    });
  }, [setRequestContext]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    append({ role: "user", content: text });
    setInput("");
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl sm:max-w-3xl z-50 flex flex-col overflow-hidden rounded-l-2xl border-l border-cyan-500/30 bg-gradient-to-b from-slate-900/98 to-[#0c1222]/98 shadow-2xl shadow-cyan-500/10"
        style={{ boxShadow: "-0 0 80px rgba(6, 182, 212, 0.08)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-orange-500/30 flex items-center justify-center border border-cyan-500/20 shadow-lg">
                <Bot className="w-8 h-8 text-cyan-300" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400/80 ring-2 ring-slate-900" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                AI assistant
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Find a movie by scene · Get suggestions from your watch history
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-cyan-400/80" />
              </div>
              <p className="text-lg text-slate-300 max-w-sm leading-relaxed">
                Describe a scene or ask for a title — I’ll search the Story Time catalog.
              </p>
              <p className="text-slate-500 mt-2 text-sm max-w-sm">
                I can also suggest films based on what you’ve been watching.
              </p>
            </div>
          )}
          {messages.map((message) => {
            const isUser = message.role === "user";
            return (
              <div
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-5 py-4 ${
                    isUser
                      ? "bg-gradient-to-br from-cyan-500/25 to-orange-500/25 text-white border border-cyan-500/20"
                      : "bg-slate-800/60 text-slate-100 border border-slate-700/60 backdrop-blur-sm"
                  }`}
                >
                  <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
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
                              className="inline-flex items-center gap-1 mt-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 transition-colors font-medium"
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
              </div>
            );
          })}
          {(status === "streaming" || status === "submitted") && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-5 py-4 bg-slate-800/60 border border-slate-700/60 flex items-center gap-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-sm text-slate-400">Generating…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="p-5 border-t border-slate-700/50 bg-slate-900/30"
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe a scene or ask for a movie..."
              className="flex-1 px-5 py-4 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-base"
              disabled={status === "streaming" || status === "submitted"}
            />
            <button
              type="submit"
              disabled={
                !input.trim() ||
                status === "streaming" ||
                status === "submitted"
              }
              className="px-6 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-cyan-500/20"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
