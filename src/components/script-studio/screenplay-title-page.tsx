"use client";

import { scriptTypeLabel } from "@/lib/script-studio/title-page";

type ScreenplayTitlePageProps = {
  title: string;
  authorName: string;
  scriptType: string;
  fontCss: string;
  pageWidth: string;
  pageHeight: string;
  pageSurfaceClassName: string;
  /** Margin below this sheet before the next page. */
  marginBottom?: number;
};

/**
 * US Letter title page shown before screenplay body pages.
 * Not part of draft.content — driven by script metadata + creator profile.
 */
export function ScreenplayTitlePage({
  title,
  authorName,
  scriptType,
  fontCss,
  pageWidth,
  pageHeight,
  pageSurfaceClassName,
  marginBottom = 36,
}: ScreenplayTitlePageProps) {
  const displayTitle = title.trim() || "Untitled Screenplay";
  const typeLabel = scriptTypeLabel(scriptType);

  return (
    <div
      className={`relative overflow-hidden ${pageSurfaceClassName}`}
      style={{
        width: pageWidth,
        maxWidth: pageWidth,
        height: pageHeight,
        marginBottom,
        boxSizing: "border-box",
      }}
      data-screenplay-title-page
      aria-label="Title page"
    >
      <div
        className="flex h-full flex-col items-center px-[1.5in] py-[1in] text-center text-inherit"
        style={{ fontFamily: fontCss, fontSize: "12pt", lineHeight: 1.35, color: "inherit" }}
      >
        {/* Industry-style vertical rhythm: title in upper third, writer mid, type lower */}
        <div className="flex flex-1 flex-col items-center justify-center gap-0 pt-[1.25in]">
          <h1 className="max-w-[5.5in] text-[14pt] font-normal uppercase tracking-[0.06em]">
            {displayTitle}
          </h1>

          <div className="mt-[1.75in] space-y-1">
            <p className="text-[12pt]">Written by</p>
            <p className="text-[12pt]">{authorName}</p>
          </div>

          <p className="mt-[1.5in] text-[12pt] opacity-80">{typeLabel}</p>
        </div>

        <p className="pointer-events-none text-[10px] opacity-40" aria-hidden>
          Title page
        </p>
      </div>
    </div>
  );
}
