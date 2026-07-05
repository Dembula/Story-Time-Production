import type {
  CallSheetCastRow,
  CallSheetHeader,
  CallSheetLocationRow,
  CallSheetSafetyLine,
  CallSheetScheduleRow,
  CallSheetTaskRow,
  CallSheetTiming,
} from "@/lib/call-sheet-builder";
import { buildCallSheetDocumentHtml } from "@/lib/call-sheet-html";
import { renderDocumentPdf } from "@/lib/pdf/html-to-pdf-server";

export type CallSheetPdfInput = {
  header: CallSheetHeader;
  timing: CallSheetTiming;
  weather?: string | null;
  logistics?: Record<string, string | null | undefined> | null;
  equipment?: { equipmentName: string; category: string; quantity: number }[];
  schedule: CallSheetScheduleRow[];
  cast: CallSheetCastRow[];
  crew: Array<{ role: string; name: string; department?: string; callTime?: string | null }>;
  locations: CallSheetLocationRow[];
  tasks?: CallSheetTaskRow[];
  safety?: CallSheetSafetyLine[];
  dayNotes?: string | null;
  extraNotes?: string | null;
  versionLabel?: string | null;
};

/** Build a formatted call sheet PDF matching the on-screen CallSheetPrintBody layout. */
export async function buildCallSheetPdf(input: CallSheetPdfInput): Promise<Buffer> {
  const { bodyHtml, extraCss } = buildCallSheetDocumentHtml({
    ...input,
    sheetNotes: input.extraNotes,
  });

  const title = `Call sheet — ${input.header.productionTitle}`;
  return renderDocumentPdf({ title, bodyHtml, extraCss });
}
