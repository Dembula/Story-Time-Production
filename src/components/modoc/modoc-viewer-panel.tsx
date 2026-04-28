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
        className="fixed inset-0 z-[1200] bg-black/72 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-x-3 bottom-3 top-[5.25rem] z-[1210] mx-auto flex w-auto max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700/90 bg-slate-950 shadow-2xl lg:inset-x-8 lg:top-[6.5rem]"
        style={{ boxShadow: "0 16px 64px rgba(2, 6, 23, 0.75)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/70 bg-slate-900/85 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/20 to-orange-500/20 shadow-lg">
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
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-slate-950 px-6 py-5">
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
                      : "border border-slate-700/70 bg-slate-900 text-slate-100"
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
              <div className="flex items-center gap-3 rounded-2xl border border-slate-700/70 bg-slate-900 px-5 py-4">
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
          className="border-t border-slate-700/70 bg-slate-900/90 p-5"
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe a scene or ask for a movie..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-base text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
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
