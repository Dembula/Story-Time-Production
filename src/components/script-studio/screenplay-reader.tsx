"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { escapeHtmlForDocument, printHtmlDocument } from "@/lib/pdf/print-html-document";
import { ScreenplayTitlePage } from "@/components/script-studio/screenplay-title-page";
import { resolveScriptAuthorName, scriptTypeLabel } from "@/lib/script-studio/title-page";
import { LINES_PER_PAGE } from "@/lib/script-studio/screenplay-keyboard";

const PAGE_WIDTH = "8.5in";
const PAGE_HEIGHT = "11in";

type ScreenplayReaderProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  fontCss?: string;
  scriptType?: string;
  authorName?: string;
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
  scriptType = "FEATURE",
  authorName,
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
  const resolvedAuthor = resolveScriptAuthorName({ name: authorName });

  const bodyPages = useMemo(() => paginateScreenplay(content), [content]);
  // Index 0 = title page; 1..n = script body
  const totalPages = bodyPages.length + 1;

  const printScreenplay = useCallback(() => {
    const typeLabel = scriptTypeLabel(scriptType);
    const titleHtml = `<section class="page title-page">
      <div class="title-block">
        <h1>${escapeHtmlForDocument(title || "Untitled Screenplay")}</h1>
        <p class="by">Written by</p>
        <p class="author">${escapeHtmlForDocument(resolvedAuthor)}</p>
        <p class="type">${escapeHtmlForDocument(typeLabel)}</p>
      </div>
    </section>`;
    const pageHtml =
      titleHtml +
      bodyPages
        .map(
          (lines, pageIndex) =>
            `<section class="page"><div class="num">${pageIndex + 1}.</div>${lines
              .map((line) => `<div class="line">${escapeHtmlForDocument(line) || "&nbsp;"}</div>`)
              .join("")}</section>`,
        )
        .join("");
    printHtmlDocument({
      title: title || "Screenplay",
      bodyHtml: pageHtml,
      extraCss: `
.page { position: relative; min-height: 10in; padding: 1in 1.5in; page-break-after: always; box-sizing: border-box; font-family: ${fontCss}; font-size: 12pt; line-height: 1.2; }
.title-page { display: flex; align-items: center; justify-content: center; text-align: center; }
.title-block h1 { font-size: 14pt; font-weight: normal; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 2in; }
.title-block .by { margin: 0; }
.title-block .author { margin: 0.25rem 0 1.5in; }
.title-block .type { margin: 0; color: #334155; }
.num { text-align: right; font-size: 10px; color: #888; margin-bottom: 1rem; }
.line { min-height: 1.2em; white-space: pre-wrap; }
`,
    });
  }, [bodyPages, title, fontCss, scriptType, resolvedAuthor]);

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
    const hits: number[] = [];
    if (
      title.toLowerCase().includes(q) ||
      resolvedAuthor.toLowerCase().includes(q) ||
      scriptTypeLabel(scriptType).toLowerCase().includes(q)
    ) {
      hits.push(0);
    }
    bodyPages.forEach((lines, i) => {
      if (lines.some((l) => l.toLowerCase().includes(q))) hits.push(i + 1);
    });
    return hits;
  }, [bodyPages, search, title, resolvedAuthor, scriptType]);

  useEffect(() => {
    if (!search.trim() || searchPages.length === 0) return;
    setPage(searchPages[searchHit % searchPages.length] ?? 0);
  }, [search, searchHit, searchPages]);

  if (!mounted) return null;

  const pageShell = (lines: string[], bodyPageNum: number) => (
    <div
      key={`body-${bodyPageNum}`}
      className={`mx-auto w-full shadow-2xl p-4 sm:p-6 md:min-h-[11in] md:max-w-[8.5in] md:p-[1in] md:pl-[1.5in] ${
        darkRead ? "bg-[#1a1a1a] text-slate-100" : "bg-white text-black"
      }`}
      style={{
        fontFamily: fontCss,
        fontSize: `${(12 * zoom) / 100}pt`,
        lineHeight: 1.2,
      }}
    >
      <div className="text-right text-[10px] opacity-50 mb-4">{bodyPageNum + 1}.</div>
      {lines.map((line, li) => (
        <div key={li} className="whitespace-pre-wrap min-h-[1.2em]">
          {line || "\u00A0"}
        </div>
      ))}
    </div>
  );

  const titleShell = (
    <div
      key="title-page"
      className={`mx-auto w-full overflow-hidden shadow-2xl md:max-w-[8.5in] ${
        darkRead ? "bg-[#1a1a1a]" : "bg-white"
      }`}
      style={{
        transform: `scale(${zoom / 100})`,
        transformOrigin: "top center",
      }}
    >
      <ScreenplayTitlePage
        title={title}
        authorName={resolvedAuthor}
        scriptType={scriptType}
        fontCss={fontCss}
        pageWidth={PAGE_WIDTH}
        pageHeight={PAGE_HEIGHT}
        pageSurfaceClassName={
          darkRead
            ? "border-slate-700 bg-[#1a1a1a] text-slate-100"
            : "border-slate-200 bg-white text-[#0f172a]"
        }
        marginBottom={0}
      />
    </div>
  );

  const renderAt = (viewPage: number) => {
    if (viewPage <= 0) return titleShell;
    return pageShell(bodyPages[viewPage - 1] ?? [], viewPage - 1);
  };

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
                onClick={printScreenplay}
              >
                <Printer className="h-3.5 w-3.5" />
              </Button>
            </div>
          </header>

          <div className="flex flex-1 min-h-0">
            <aside className="storytime-panel-divider-r hidden lg:block w-28 shrink-0 overflow-y-auto bg-slate-900/80 p-2 space-y-2">
              {Array.from({ length: totalPages }, (_, i) => (
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
                  {i === 0 ? "Title" : `p.${i}`}
                </button>
              ))}
            </aside>

            <main className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 md:p-8">
              <div
                className={`mx-auto w-full space-y-8 ${
                  spread
                    ? "max-w-[17in] grid grid-cols-1 xl:grid-cols-2 gap-8"
                    : "md:max-w-[8.5in]"
                }`}
              >
                {spread && page + 1 < totalPages ? (
                  <>
                    {renderAt(page)}
                    {renderAt(page + 1)}
                  </>
                ) : (
                  renderAt(page)
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
              {page === 0 ? "Title page" : `Page ${page}`} of {totalPages}
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
