"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  Printer,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadTextFile } from "@/lib/script-studio/import-export";

const LINES_PER_PAGE = 55;

type ScreenplayReaderProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  fontCss?: string;
};

function paginateScreenplay(content: string): string[][] {
  const lines = content.split(/\r?\n/);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }
  if (pages.length === 0) pages.push([""]);
  return pages;
}

export function ScreenplayReader({
  open,
  onClose,
  title,
  content,
  fontCss = "'Courier Prime', 'Courier New', monospace",
}: ScreenplayReaderProps) {
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [spread, setSpread] = useState(false);
  const [darkRead, setDarkRead] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchHit, setSearchHit] = useState(0);
  const onCloseRef = useRef(onClose);
  const wasOpenRef = useRef(false);

  const pages = useMemo(() => paginateScreenplay(content), [content]);
  const totalPages = pages.length;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setPage(0);
      setSearch("");
      setSearchHit(0);
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "ArrowRight") setPage((p) => Math.min(totalPages - 1, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, totalPages]);

  const searchPages = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return pages
      .map((lines, i) => ({ i, hit: lines.some((l) => l.toLowerCase().includes(q)) }))
      .filter((p) => p.hit)
      .map((p) => p.i);
  }, [pages, search]);

  useEffect(() => {
    if (!search.trim() || searchPages.length === 0) return;
    setPage(searchPages[searchHit % searchPages.length] ?? 0);
  }, [search, searchHit, searchPages]);

  if (!mounted) return null;

  const pageShell = (lines: string[], pageNum: number) => (
    <div
      key={pageNum}
      className={`mx-auto w-full max-w-[8.5in] min-h-[11in] shadow-2xl ${
        darkRead ? "bg-[#1a1a1a] text-slate-100" : "bg-white text-black"
      }`}
      style={{
        fontFamily: fontCss,
        fontSize: `${(12 * zoom) / 100}pt`,
        lineHeight: 1.2,
        padding: "1in 1in 1in 1.5in",
      }}
    >
      <div className="text-right text-[10px] opacity-50 mb-4">{pageNum + 1}.</div>
      {lines.map((line, li) => (
        <div key={li} className="whitespace-pre-wrap min-h-[1.2em]">
          {line || "\u00A0"}
        </div>
      ))}
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`fixed inset-0 z-[2100] flex flex-col ${darkRead ? "bg-slate-950" : "bg-slate-200"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/95 px-4 py-2">
            <Button size="sm" variant="ghost" className="text-slate-300" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-white truncate max-w-[200px]">{title}</span>
            <div className="flex items-center gap-1 ml-auto">
              <div className="relative hidden sm:block">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchHit(0);
                  }}
                  placeholder="Search script…"
                  className="h-8 w-44 pl-8 bg-slate-800 border-slate-700 text-xs text-white"
                />
              </div>
              {searchPages.length > 1 ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-700 text-xs text-slate-200"
                  onClick={() => setSearchHit((h) => h + 1)}
                >
                  Next hit
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 text-slate-200"
                onClick={() => setZoom((z) => Math.max(70, z - 10))}
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] text-slate-400 w-10 text-center">{zoom}%</span>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 text-slate-200"
                onClick={() => setZoom((z) => Math.min(150, z + 10))}
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 text-xs text-slate-200"
                onClick={() => setSpread((s) => !s)}
              >
                {spread ? "Single" : "Spread"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 text-xs text-slate-200"
                onClick={() => setDarkRead((d) => !d)}
              >
                {darkRead ? "Light read" : "Dark read"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 text-slate-200"
                onClick={() => setFullscreen((f) => !f)}
              >
                {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 text-slate-200"
                onClick={() => downloadTextFile(`${title || "screenplay"}.txt`, content)}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 text-slate-200"
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5" />
              </Button>
            </div>
          </header>

          <div className="flex flex-1 min-h-0">
            <aside className="storytime-panel-divider-r hidden lg:block w-28 shrink-0 overflow-y-auto bg-slate-900/80 p-2 space-y-2">
              {pages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i)}
                  className={`w-full rounded border px-1 py-2 text-[10px] ${
                    i === page
                      ? "border-orange-500 bg-orange-500/10 text-orange-200"
                      : "border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  p.{i + 1}
                </button>
              ))}
            </aside>

            <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 md:p-8">
              <div
                className={`mx-auto space-y-8 ${spread ? "max-w-[17in] grid grid-cols-1 xl:grid-cols-2 gap-8" : "max-w-[min(8.5in,100%)]"}`}
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
              >
                {spread && page + 1 < totalPages ? (
                  <>
                    {pageShell(pages[page] ?? [], page)}
                    {pageShell(pages[page + 1] ?? [], page + 1)}
                  </>
                ) : (
                  pageShell(pages[page] ?? [], page)
                )}
              </div>
            </main>
          </div>

          <footer className="flex shrink-0 items-center justify-center gap-4 border-t border-slate-800 bg-slate-900/95 py-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-slate-400">
              Page {page + 1} of {totalPages}
            </span>
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={page + 1}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) setPage(Math.min(totalPages - 1, Math.max(0, n - 1)));
              }}
              className="h-7 w-16 text-center text-xs bg-slate-800 border-slate-700 text-white"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="text-slate-300"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </footer>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
