import { ReactNode } from "react";

type LegalSection = {
  title: string;
  content: ReactNode;
};

interface LegalPageProps {
  eyebrow: string;
  title: string;
  summary: string;
  lastUpdated: string;
  highlights?: string[];
  sections: LegalSection[];
  footerNote?: ReactNode;
}

export function LegalPage({
  eyebrow,
  title,
  summary,
  lastUpdated,
  highlights = [],
  sections,
  footerNote,
}: LegalPageProps) {
  return (
    <article className="space-y-4 overflow-x-hidden sm:space-y-6">
      <section className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 shadow-panel sm:rounded-[28px] sm:p-6 md:p-8">
        <div className="space-y-3 sm:space-y-4">
          <div className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:text-[11px]">
            {eyebrow}
          </div>
          <div className="space-y-2 sm:space-y-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-300 break-words md:text-base md:leading-7">
              {summary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 sm:gap-3 sm:text-sm">
            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 sm:px-3 sm:py-1.5">
              Last updated: {lastUpdated}
            </span>
            {highlights.map((item) => (
              <span
                key={item}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-slate-300 sm:px-3 sm:py-1.5"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:gap-4">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-white/8 bg-zinc-950/60 p-4 shadow-panel sm:rounded-3xl sm:p-6"
          >
            <h2 className="mb-2 text-lg font-semibold text-white sm:mb-3 sm:text-xl">{section.title}</h2>
            <div className="space-y-3 break-words text-sm leading-relaxed text-slate-300 sm:leading-7 md:text-[15px]">
              {section.content}
            </div>
          </section>
        ))}
      </div>

      {footerNote && (
        <section className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm leading-relaxed text-slate-400 sm:rounded-3xl sm:p-6 sm:leading-7">
          {footerNote}
        </section>
      )}
    </article>
  );
}
