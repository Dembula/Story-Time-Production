"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Minus,
  Plus,
  Printer,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { paginateContractTerms } from "@/lib/contract-document-format";
import { watermarkForStatus } from "@/lib/contract-lifecycle";

export type ContractDocumentViewerProps = {
  title: string;
  terms: string;
  status: string;
  projectTitle?: string | null;
  productionCompany?: string | null;
  jurisdiction?: string | null;
  recipientLabel?: string | null;
  signatures?: Array<{ name: string; role: string | null; signedAt: string }>;
  editable?: boolean;
  onTermsChange?: (terms: string) => void;
  className?: string;
};

export function ContractDocumentViewer({
  title,
  terms,
  status,
  projectTitle,
  productionCompany,
  jurisdiction,
  recipientLabel,
  signatures = [],
  editable = false,
  onTermsChange,
  className = "",
}: ContractDocumentViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [pageIndex, setPageIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [darkPaper, setDarkPaper] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => paginateContractTerms(terms), [terms]);
  const watermark = watermarkForStatus(status);
  const pageCount = pages.length;

  const searchHits = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    const re = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    return (terms.match(re) ?? []).length;
  }, [terms, searchQuery]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownload = useCallback(() => {
    const blob = new Blob([terms], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [terms, title]);

  const pageContent = pages[pageIndex] ?? "";

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-2 print:hidden">
        <Button type="button" size="sm" variant="outline" className="h-8 border-slate-600" onClick={() => setZoom((z) => Math.max(70, z - 10))}>
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-slate-400 w-12 text-center">{zoom}%</span>
        <Button type="button" size="sm" variant="outline" className="h-8 border-slate-600" onClick={() => setZoom((z) => Math.min(150, z + 10))}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <div className="h-5 w-px bg-slate-700 mx-1" />
        <Button type="button" size="sm" variant="outline" className="h-8 border-slate-600" disabled={pageIndex <= 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs text-slate-400 min-w-[4.5rem] text-center">
          {pageIndex + 1} / {pageCount}
        </span>
        <Button type="button" size="sm" variant="outline" className="h-8 border-slate-600" disabled={pageIndex >= pageCount - 1} onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <div className="h-5 w-px bg-slate-700 mx-1" />
        <Button type="button" size="sm" variant="outline" className="h-8 border-slate-600" onClick={() => setSearchOpen((o) => !o)}>
          <Search className="h-3.5 w-3.5 mr-1" />
          Search
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 border-slate-600" onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5 mr-1" />
          Print
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 border-slate-600" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5 mr-1" />
          Download
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 text-slate-400" onClick={() => setDarkPaper((d) => !d)}>
          {darkPaper ? "Light paper" : "Dark paper"}
        </Button>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-2 print:hidden">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search document…"
            className="h-9 bg-slate-900 border-slate-700 text-sm"
          />
          {searchQuery && (
            <span className="text-xs text-slate-400 whitespace-nowrap">{searchHits} match{searchHits === 1 ? "" : "es"}</span>
          )}
          <button type="button" className="text-slate-400 hover:text-white" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div ref={printRef} className="overflow-auto rounded-lg border border-slate-700 bg-slate-950/50 p-4 md:p-8 print:p-0 print:border-0 print:bg-white">
        <div
          className={`contract-legal-page mx-auto shadow-2xl transition-transform origin-top ${
            darkPaper ? "bg-slate-900 text-slate-100 border-slate-700" : "bg-white text-slate-900 border-slate-200"
          } border relative`}
          style={{
            width: "8.5in",
            minHeight: "11in",
            padding: "0.75in 1in",
            transform: `scale(${zoom / 100})`,
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: "11pt",
            lineHeight: 1.45,
          }}
        >
          {watermark && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
              aria-hidden
            >
              <span
                className="select-none text-[4.5rem] font-bold tracking-widest opacity-[0.08] -rotate-[35deg]"
                style={{ color: darkPaper ? "#fff" : "#000" }}
              >
                {watermark}
              </span>
            </div>
          )}

          <header className="border-b border-current/20 pb-3 mb-4 text-[10pt]">
            <div className="flex justify-between items-start gap-4">
              <div>
                {productionCompany && (
                  <p className="font-semibold uppercase tracking-wide text-[9pt]">{productionCompany}</p>
                )}
                {projectTitle && <p className="text-current/70 mt-0.5">{projectTitle}</p>}
              </div>
              <div className="text-right text-current/60">
                {jurisdiction && <p>{jurisdiction}</p>}
                <p className="mt-1">Confidential</p>
              </div>
            </div>
            <h1 className="text-center text-[14pt] font-bold mt-4 mb-1">{title}</h1>
            {recipientLabel && (
              <p className="text-center text-[10pt] text-current/70">Party: {recipientLabel}</p>
            )}
          </header>

          {editable ? (
            <textarea
              value={terms}
              onChange={(e) => onTermsChange?.(e.target.value)}
              className={`w-full min-h-[8.5in] resize-y bg-transparent border-0 outline-none font-inherit text-inherit leading-inherit ${
                darkPaper ? "text-slate-100" : "text-slate-900"
              }`}
              style={{ fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit" }}
            />
          ) : (
            <article className="whitespace-pre-wrap contract-body">{pageContent}</article>
          )}

          {signatures.length > 0 && pageIndex === pageCount - 1 && !editable && (
            <footer className="mt-8 pt-4 border-t border-current/20 space-y-4">
              <p className="text-[10pt] font-semibold uppercase tracking-wide">Execution</p>
              {signatures.map((sig) => (
                <div key={`${sig.name}-${sig.signedAt}`} className="text-[10pt]">
                  <p className="font-semibold">{sig.name}{sig.role ? ` — ${sig.role}` : ""}</p>
                  <p className="text-current/60">Signed {new Date(sig.signedAt).toLocaleString()}</p>
                  <div className="mt-2 border-b border-current/40 w-48" />
                </div>
              ))}
            </footer>
          )}

          <div className="absolute bottom-6 left-0 right-0 text-center text-[9pt] text-current/50">
            Page {pageIndex + 1} of {pageCount}
          </div>
        </div>
      </div>
    </div>
  );
}
