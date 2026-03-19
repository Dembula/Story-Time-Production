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
    <article className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-6 shadow-panel backdrop-blur-xl md:p-8">
        <div className="space-y-4">
          <div className="inline-flex items-center rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">
            {eyebrow}
          </div>
          <div className="space-y-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              {summary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
              Last updated: {lastUpdated}
            </span>
            {highlights.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-3xl border border-white/8 bg-slate-950/55 p-6 shadow-panel backdrop-blur-xl"
          >
            <h2 className="mb-3 text-xl font-semibold text-white">{section.title}</h2>
            <div className="space-y-3 text-sm leading-7 text-slate-300 md:text-[15px]">
              {section.content}
            </div>
          </section>
        ))}
      </div>

      {footerNote && (
        <section className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm leading-7 text-slate-400">
          {footerNote}
        </section>
      )}
    </article>
  );
}
