"use client";

import { SCRIPT_TYPE_LABELS, scriptTypeLabel } from "@/lib/script-studio/title-page";

const SCRIPT_TYPES = ["FEATURE", "SHORT", "EPISODE", "OTHER"] as const;

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
  readOnly?: boolean;
  /** Draft title — also updates the script name in the toolbar. */
  onTitleChange?: (title: string) => void;
  /** Script-only writer credit — does not change the account profile name. */
  onAuthorNameChange?: (authorName: string) => void;
  onScriptTypeChange?: (type: string) => void;
};

/**
 * US Letter title page shown before screenplay body pages.
 * Not part of draft.content — driven by script metadata + optional writer credit.
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
  readOnly = true,
  onTitleChange,
  onAuthorNameChange,
  onScriptTypeChange,
}: ScreenplayTitlePageProps) {
  const typeKey = (scriptType || "FEATURE").toUpperCase();
  const typeLabel = scriptTypeLabel(scriptType);
  const fieldClass =
    "w-full max-w-[5.5in] border-0 bg-transparent p-0 text-center text-inherit outline-none " +
    "placeholder:opacity-35 focus:ring-0 " +
    (readOnly ? "" : "rounded-sm hover:bg-black/[0.03] focus:bg-black/[0.04]");

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
        <div className="flex flex-1 flex-col items-center justify-center gap-0 pt-[1.25in]">
          {readOnly ? (
            <h1 className="max-w-[5.5in] text-[14pt] font-normal uppercase tracking-[0.06em]">
              {title.trim() || "Untitled Screenplay"}
            </h1>
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange?.(e.target.value)}
              placeholder="Untitled Screenplay"
              aria-label="Script title"
              className={`${fieldClass} text-[14pt] font-normal uppercase tracking-[0.06em]`}
            />
          )}

          <div className="mt-[1.75in] w-full max-w-[5.5in] space-y-1">
            <p className="text-[12pt]">Written by</p>
            {readOnly ? (
              <p className="text-[12pt]">{authorName}</p>
            ) : (
              <input
                type="text"
                value={authorName}
                onChange={(e) => onAuthorNameChange?.(e.target.value)}
                placeholder="Writer name"
                aria-label="Written by (this script only — does not change your account name)"
                title="Credit for this script only. Does not change your account name."
                className={`${fieldClass} text-[12pt]`}
              />
            )}
          </div>

          {readOnly ? (
            <p className="mt-[1.5in] text-[12pt] opacity-80">{typeLabel}</p>
          ) : (
            <label className="mt-[1.5in] inline-flex flex-col items-center gap-1">
              <span className="sr-only">Script type</span>
              <select
                value={SCRIPT_TYPE_LABELS[typeKey] ? typeKey : "OTHER"}
                onChange={(e) => onScriptTypeChange?.(e.target.value)}
                aria-label="Script type"
                className={`${fieldClass} cursor-pointer appearance-none text-[12pt] opacity-80`}
                style={{ width: "auto", minWidth: "8rem" }}
              >
                {SCRIPT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SCRIPT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <p className="pointer-events-none text-[10px] opacity-40" aria-hidden>
          {readOnly ? "Title page" : "Title page · click fields to edit"}
        </p>
      </div>
    </div>
  );
}
