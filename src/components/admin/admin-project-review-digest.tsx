"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-white/8 bg-black/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-slate-200"
      >
        {title}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open ? <div className="border-t border-white/8 px-3 py-2">{children}</div> : null}
    </div>
  );
}

export function AdminProjectReviewDigest({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-project-digest", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/projects/${projectId}/digest`);
      if (!res.ok) throw new Error("Failed to load project review digest");
      return res.json();
    },
  });

  if (isLoading) return <p className="text-xs text-slate-500">Loading full project review dossier…</p>;
  if (isError || !data?.project) return null;

  const toolProgress = (data.toolProgress ?? []) as { label: string; status: string; percent: number; phase: string }[];
  const scripts = (data.scripts ?? []) as {
    id: string;
    title: string;
    versions: { id: string; versionLabel: string | null; preview: string; characterCount: number; truncated: boolean }[];
  }[];
  const scenes = (data.scenes ?? []) as { number: string; heading: string | null; summary: string | null }[];
  const linked = (data.linkedContent ?? []) as {
    id: string;
    title: string;
    reviewStatus: string;
    videoUrl: string | null;
    trailerUrl: string | null;
    scriptUrl: string | null;
    platformScript?: {
      versionId: string;
      scriptTitle: string;
      versionLabel: string | null;
      preview: string;
      characterCount: number;
      truncated: boolean;
    } | null;
  }[];

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-300/90">Project review dossier</p>
          <p className="text-sm font-medium text-white">{data.project.title}</p>
          <p className="text-[11px] text-slate-400">
            {data.project.phase} · {data.project.status}
            {data.project.originalBadge?.tone === "greenlit" && (
              <span className="ml-2 text-orange-300">Story Time Original (greenlit)</span>
            )}
            {data.project.originalBadge?.tone === "pending" && (
              <span className="ml-2 text-sky-300">Originals application only — not greenlit</span>
            )}
            {!data.project.originalBadge?.tone && (
              <span className="ml-2 text-slate-500">Standard pipeline project (not an Original)</span>
            )}
          </p>
        </div>
        <Link
          href={`/admin/projects#project-${projectId}`}
          className="inline-flex items-center gap-1 text-[11px] text-orange-300 hover:text-orange-200"
        >
          Open in projects <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {data.project.synopsis && (
        <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">{data.project.synopsis}</p>
      )}

      <Section title={`Pipeline tools (${toolProgress.filter((t) => t.status === "COMPLETE").length}/${toolProgress.length} complete)`} defaultOpen>
        <ul className="space-y-1 text-[11px] text-slate-400">
          {toolProgress.map((t) => (
            <li key={t.label}>
              <span className="text-slate-200">{t.label}</span> · {t.phase} · {t.status} · {t.percent}%
            </li>
          ))}
        </ul>
      </Section>

      {scripts.length > 0 && (
        <Section title={`Scripts (${scripts.length})`} defaultOpen>
          {scripts.map((s) => (
            <div key={s.id} className="mb-3 last:mb-0">
              <p className="text-xs font-medium text-white">{s.title}</p>
              {s.versions.map((v) => (
                <div key={v.id} className="mt-2">
                  <p className="text-[10px] text-slate-500">
                    {v.versionLabel || "Version"} · {v.characterCount.toLocaleString()} chars
                    {v.truncated ? " · preview truncated" : ""}
                  </p>
                  <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/50 p-2 font-mono text-[10px] leading-relaxed text-slate-300">
                    {v.preview}
                  </pre>
                </div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {scenes.length > 0 && (
        <Section title={`Scenes (${scenes.length})`}>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-slate-400">
            {scenes.map((s) => (
              <li key={`${s.number}-${s.heading}`}>
                <span className="text-slate-200">Sc {s.number}</span>
                {s.heading ? ` · ${s.heading}` : ""}
                {s.summary ? ` — ${s.summary}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(data.casting?.length ?? 0) > 0 && (
        <Section title={`Casting roles (${data.casting.length})`}>
          <ul className="space-y-1 text-[11px] text-slate-400">
            {data.casting.map((r: { role: string; status: string; description: string | null }) => (
              <li key={r.role}>
                <span className="text-slate-200">{r.role}</span> · {r.status}
                {r.description ? ` — ${r.description}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(data.crew?.length ?? 0) > 0 && (
        <Section title={`Crew needs (${data.crew.length})`}>
          <ul className="space-y-1 text-[11px] text-slate-400">
            {data.crew.map((n: { role: string; department: string | null; notes: string | null }) => (
              <li key={n.role}>
                <span className="text-slate-200">{n.role}</span>
                {n.department ? ` · ${n.department}` : ""}
                {n.notes ? ` · ${n.notes}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(data.footage?.length ?? 0) > 0 && (
        <Section title={`Footage & assets (${data.footage.length})`}>
          <ul className="space-y-1 text-[11px]">
            {data.footage.map((f: { id: string; label: string | null; type: string; fileUrl: string }) => (
              <li key={f.id}>
                <a href={f.fileUrl} target="_blank" rel="noreferrer" className="text-orange-300 hover:underline">
                  {f.label || f.type}
                </a>
                <span className="text-slate-500"> · {f.type}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(data.music?.length ?? 0) > 0 && (
        <Section title={`Music selections (${data.music.length})`}>
          <ul className="space-y-1 text-[11px] text-slate-400">
            {data.music.map((m: { id: string; trackTitle: string; artist: string | null; usage: string | null; notes: string | null }) => (
              <li key={m.id}>
                <span className="text-slate-200">{m.trackTitle}</span>
                {m.artist ? ` · ${m.artist}` : ""}
                {m.usage ? ` · ${m.usage}` : ""}
                {m.notes ? ` — ${m.notes}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(data.visualAssets?.length ?? 0) > 0 && (
        <Section title={`Visual assets (${data.visualAssets.length})`}>
          <ul className="space-y-1 text-[11px]">
            {data.visualAssets.map((a: { id: string; title: string | null; category: string; imageUrl: string; caption: string | null }) => (
              <li key={a.id}>
                <a href={a.imageUrl} target="_blank" rel="noreferrer" className="text-orange-300 hover:underline">
                  {a.title || a.category}
                </a>
                <span className="text-slate-500"> · {a.category}</span>
                {a.caption ? <span className="text-slate-500"> — {a.caption}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(data.distribution?.length ?? 0) > 0 && (
        <Section title={`Distribution submissions (${data.distribution.length})`}>
          <ul className="space-y-1 text-[11px] text-slate-400">
            {data.distribution.map((d: { id: string; target: string; status: string; createdAt?: string }) => (
              <li key={d.id}>
                <span className="text-slate-200">{d.target}</span> · {d.status}
                {d.createdAt ? ` · ${new Date(d.createdAt).toLocaleDateString()}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(data.postProductionReviews?.length ?? 0) > 0 && (
        <Section title={`Post-production reviews (${data.postProductionReviews.length})`}>
          <ul className="space-y-1 text-[11px] text-slate-400">
            {data.postProductionReviews.map((r: { id: string; status: string; notes: { body: string }[]; createdAt?: string }) => (
              <li key={r.id}>
                {r.status}
                {r.notes?.length
                  ? ` — ${r.notes.map((n) => n.body).join("; ")}`
                  : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {linked.length > 0 && (
        <Section title="Linked catalogue submissions" defaultOpen>
          <ul className="space-y-3 text-[11px]">
            {linked.map((c) => (
              <li key={c.id} className="text-slate-300 space-y-1">
                <p>
                  {c.title} · {c.reviewStatus}
                  {c.videoUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={c.videoUrl} target="_blank" rel="noreferrer" className="text-orange-300 hover:underline">
                        Watch master
                      </a>
                    </>
                  )}
                  {c.scriptUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={c.scriptUrl} target="_blank" rel="noreferrer" className="text-orange-300 hover:underline">
                        Uploaded script PDF
                      </a>
                    </>
                  )}
                </p>
                {c.platformScript && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                    <p className="text-[10px] font-medium text-emerald-300">
                      Platform screenplay: {c.platformScript.scriptTitle}
                      {c.platformScript.versionLabel ? ` (${c.platformScript.versionLabel})` : ""}
                      {" · "}
                      {c.platformScript.characterCount.toLocaleString()} chars
                      {c.platformScript.truncated ? " · preview truncated" : ""}
                    </p>
                    <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-black/50 p-2 font-mono text-[10px] leading-relaxed text-slate-300">
                      {c.platformScript.preview}
                    </pre>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.pitches?.length > 0 && (
        <Section title="Originals pitches">
          <ul className="space-y-1 text-[11px] text-slate-400">
            {data.pitches.map((p: { id: string; title: string; status: string; synopsis: string | null }) => (
              <li key={p.id}>
                <span className="text-slate-200">{p.title}</span> · {p.status}
                {p.synopsis ? ` — ${p.synopsis.slice(0, 120)}${p.synopsis.length > 120 ? "…" : ""}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
