"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ToolViewTab = {
  id: string;
  label: string;
  badge?: number;
};

type ToolSavedViewSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  tabs?: ToolViewTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function ToolSavedViewSheet({
  open,
  onClose,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  children,
  footer,
}: ToolSavedViewSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close panel"
            className="fixed inset-0 z-[2100] bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="tool-view-title"
            className="fixed z-[2110] flex flex-col border-l border-orange-500/20 bg-gradient-to-b from-slate-950 via-slate-950 to-black shadow-2xl shadow-black/40"
            style={{
              top: 0,
              right: 0,
              width: "min(520px, 100vw)",
              height: "100dvh",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <header className="shrink-0 border-b border-slate-800/80 px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-orange-300/80">
                    Saved data
                  </p>
                  <h2 id="tool-view-title" className="font-display text-lg font-semibold text-white truncate">
                    {title}
                  </h2>
                  {subtitle ? (
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{subtitle}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={onClose}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {tabs && tabs.length > 1 ? (
                <nav className="mt-4 flex gap-1 overflow-x-auto pb-0.5" aria-label="View sections">
                  {tabs.map((tab) => {
                    const active = (activeTab ?? tabs[0].id) === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => onTabChange?.(tab.id)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? "bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/30"
                            : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                        }`}
                      >
                        {tab.label}
                        {tab.badge != null && tab.badge > 0 ? (
                          <span className="ml-1.5 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300">
                            {tab.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </nav>
              ) : null}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

            {footer ? (
              <footer className="shrink-0 border-t border-slate-800/80 px-4 py-3 sm:px-5">{footer}</footer>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
