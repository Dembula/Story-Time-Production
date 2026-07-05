"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { resolveNetworkDisplayName } from "@/lib/network-display-name";
import { SecureFileLink } from "@/components/files/secure-file-link";
import { SecureImage } from "@/components/files/secure-image";

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

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function personLabel(p: {
  name?: string | null;
  email?: string | null;
  networkHandle?: string | null;
  professionalName?: string | null;
}) {
  return (
    p.professionalName?.trim() ||
    resolveNetworkDisplayName({
      name: p.name,
      networkHandle: p.networkHandle,
      email: p.email,
    })
  );
}

export function AdminProjectReviewDigest({
  projectId,
  hideProjectsLink = false,
}: {
  projectId: string;
  hideProjectsLink?: boolean;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-project-digest", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/projects/${projectId}/digest`);
      if (!res.ok) throw new Error("Failed to load project review digest");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-4">
        <p className="text-xs text-slate-500">Loading full project dossier…</p>
      </div>
    );
  }
  if (isError || !data?.project) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
        <p className="text-xs text-red-300">Could not load project details.</p>
      </div>
    );
  }

  const toolProgress = (data.toolProgress ?? []) as {
    toolId: string;
    label: string;
    status: string;
    percent: number;
    phase: string;
  }[];
  const rollup = data.pipelineRollup as
    | {
        progressPercent: number;
        completeCount: number;
        skippedCount: number;
        inProgressCount: number;
        notStartedCount: number;
        totalTracked: number;
      }
    | undefined;
  const scripts = (data.scripts ?? []) as {
    id: string;
    title: string;
    versions: {
      id: string;
      versionLabel: string | null;
      preview: string;
      characterCount: number;
      truncated: boolean;
    }[];
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
  const creators = (data.creators ?? []) as {
    id: string;
    name: string | null;
    email: string | null;
    networkHandle: string | null;
    bio: string | null;
    headline: string | null;
    location: string | null;
    website: string | null;
    role: string;
    professionalName: string | null;
    primaryRole: string | null;
    isLead: boolean;
    pitchCount: number;
    createdAt: string;
  }[];
  const team = (data.team ?? []) as {
    id: string;
    userId: string;
    role: string;
    department: string | null;
    status: string;
    name: string | null;
    email: string | null;
    networkHandle: string | null;
    headline: string | null;
    location: string | null;
    bio: string | null;
    professionalName: string | null;
    userRole: string;
  }[];
  const activity = (data.activityCounts ?? data.breakdownCounts ?? {}) as Record<string, number>;
  const budgets = (data.budgets ?? []) as {
    id: string;
    name: string;
    isDefault: boolean;
    currency: string;
    totalPlanned: number;
    lineCount: number;
    generationSource: string | null;
  }[];

  const toolsByPhase = {
    PRE_PRODUCTION: toolProgress.filter((t) => t.phase === "PRE_PRODUCTION"),
    PRODUCTION: toolProgress.filter((t) => t.phase === "PRODUCTION"),
    POST_PRODUCTION: toolProgress.filter((t) => t.phase === "POST_PRODUCTION"),
  };

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-300/90">
            Project review dossier
          </p>
          <p className="text-sm font-medium text-white">{data.project.title}</p>
          <p className="text-[11px] text-slate-400">
            {data.project.phase} · {data.project.status}
            {data.project.type ? ` · ${data.project.type}` : ""}
            {data.project.genre ? ` · ${data.project.genre}` : ""}
            {data.project.originalBadge?.tone === "greenlit" && (
              <span className="ml-2 text-orange-300">Story Time Original (greenlit)</span>
            )}
            {data.project.originalBadge?.tone === "pending" && (
              <span className="ml-2 text-sky-300">Originals application only — not greenlit</span>
            )}
            {!data.project.originalBadge?.tone && (
              <span className="ml-2 text-slate-500">Standard pipeline project</span>
            )}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Created {new Date(data.project.createdAt).toLocaleString()}
            {" · "}
            Updated {new Date(data.project.updatedAt).toLocaleString()}
            {data.project.targetDate ? ` · Target ${data.project.targetDate}` : ""}
            {data.project.budget != null ? ` · Budget est. ${data.project.budget}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/creator/projects/${projectId}/workspace`}
            target="_blank"
            className="inline-flex items-center gap-1 text-[11px] text-orange-300 hover:text-orange-200"
          >
            Creator workspace <ExternalLink className="h-3 w-3" />
          </Link>
          {!hideProjectsLink && (
            <Link
              href={`/admin/projects#project-${projectId}`}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
            >
              Projects list <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {data.project.logline && (
        <p className="text-xs leading-relaxed text-slate-300">{data.project.logline}</p>
      )}
      {data.project.synopsis && (
        <p className="text-xs leading-relaxed text-slate-400 whitespace-pre-wrap">{data.project.synopsis}</p>
      )}
      {data.project.adminNote && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <span className="font-semibold">Admin note:</span> {data.project.adminNote}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <StatChip
          label="Pipeline"
          value={rollup ? `${rollup.progressPercent}%` : "—"}
        />
        <StatChip
          label="Tools done"
          value={
            rollup
              ? `${rollup.completeCount}/${rollup.totalTracked}`
              : `${toolProgress.filter((t) => t.status === "COMPLETE").length}/${toolProgress.length}`
          }
        />
        <StatChip label="Team" value={team.length} />
        <StatChip label="Scenes" value={activity.scenes ?? scenes.length} />
        <StatChip label="Shoot days" value={activity.shootDays ?? 0} />
        <StatChip label="Catalogue" value={activity.linkedCatalogue ?? linked.length} />
      </div>

      <Section title={`Creators (${creators.length})`} defaultOpen>
        {creators.length === 0 ? (
          <p className="text-[11px] text-slate-500">No creator profiles linked via pitches yet.</p>
        ) : (
          <ul className="space-y-3">
            {creators.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-slate-400"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {personLabel(c)}
                      {c.isLead ? (
                        <span className="ml-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-200">
                          Lead
                        </span>
                      ) : null}
                    </p>
                    {c.networkHandle ? (
                      <p className="text-orange-300/90">@{c.networkHandle}</p>
                    ) : null}
                    <p className="text-slate-500">
                      {c.email || "No email"} · account role {c.role}
                      {c.primaryRole ? ` · ${c.primaryRole}` : ""}
                    </p>
                    {c.headline ? <p className="mt-1 text-slate-300">{c.headline}</p> : null}
                    {c.bio ? <p className="mt-1 line-clamp-3 text-slate-400">{c.bio}</p> : null}
                    <p className="mt-1 text-slate-500">
                      {[c.location, c.website].filter(Boolean).join(" · ") || "No location/website"}
                      {" · "}
                      Joined {new Date(c.createdAt).toLocaleDateString()}
                      {c.pitchCount > 0 ? ` · ${c.pitchCount} pitch(es)` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/creator/profile/${c.id}`}
                      target="_blank"
                      className="text-orange-300 hover:underline"
                    >
                      Public profile
                    </Link>
                    <Link href="/admin/users" className="text-slate-400 hover:text-slate-200">
                      Admin users
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Team & collaborators (${team.length})`} defaultOpen>
        {team.length === 0 ? (
          <p className="text-[11px] text-slate-500">No team members recorded.</p>
        ) : (
          <ul className="space-y-2 text-[11px] text-slate-400">
            {team.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/6 bg-black/15 px-2.5 py-2"
              >
                <div>
                  <p className="text-slate-200">
                    {personLabel(m)}
                    {m.networkHandle ? (
                      <span className="ml-1 text-orange-300/80">@{m.networkHandle}</span>
                    ) : null}
                  </p>
                  <p>
                    {m.role}
                    {m.department ? ` · ${m.department}` : ""} · {m.status}
                    {m.email ? ` · ${m.email}` : ""}
                  </p>
                  {m.headline ? <p className="text-slate-500">{m.headline}</p> : null}
                </div>
                <Link
                  href={`/creator/profile/${m.userId}`}
                  target="_blank"
                  className="text-orange-300 hover:underline"
                >
                  Profile
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Activity snapshot" defaultOpen>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 text-[11px]">
          {[
            ["Ideas", activity.ideas],
            ["Scripts", activity.scripts],
            ["Scenes", activity.scenes],
            ["Breakdown chars", activity.breakdownCharacters],
            ["Props", activity.breakdownProps],
            ["Locations", activity.breakdownLocations],
            ["Casting roles", activity.castingRoles],
            ["Crew needs", activity.crewNeeds],
            ["Budgets", activity.budgets],
            ["Shoot days", activity.shootDays],
            ["Call sheets", activity.callSheets],
            ["Tasks", activity.projectTasks],
            ["Contracts", activity.projectContracts],
            ["Equipment items", activity.equipmentPlanItems],
            ["Table reads", activity.tableReadSessions],
            ["Dailies clips", activity.dailiesClips],
            ["Incidents", activity.incidentReports],
            ["Catalogue links", activity.linkedCatalogue],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded border border-white/6 bg-black/20 px-2 py-1.5">
              <span className="text-slate-500">{label}</span>
              <span className="ml-2 font-medium text-slate-200">{value ?? 0}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={`Pipeline tools (${
          rollup
            ? `${rollup.completeCount} complete · ${rollup.skippedCount} skipped · ${rollup.inProgressCount} in progress`
            : `${toolProgress.filter((t) => t.status === "COMPLETE").length}/${toolProgress.length} complete`
        })`}
        defaultOpen
      >
        {(["PRE_PRODUCTION", "PRODUCTION", "POST_PRODUCTION"] as const).map((phase) => {
          const rows = toolsByPhase[phase];
          if (rows.length === 0) return null;
          return (
            <div key={phase} className="mb-3 last:mb-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {phase.replaceAll("_", " ")}
              </p>
              <ul className="space-y-1 text-[11px] text-slate-400">
                {rows.map((t) => (
                  <li key={t.toolId} className="flex flex-wrap gap-x-2">
                    <span className="text-slate-200">{t.label}</span>
                    <span
                      className={
                        t.status === "COMPLETE"
                          ? "text-emerald-300"
                          : t.status === "SKIPPED"
                            ? "text-slate-500"
                            : t.status === "IN_PROGRESS"
                              ? "text-amber-300"
                              : "text-slate-500"
                      }
                    >
                      {t.status}
                    </span>
                    <span>{t.percent}%</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Section>

      {budgets.length > 0 && (
        <Section title={`Budgets (${budgets.length})`}>
          <ul className="space-y-1 text-[11px] text-slate-400">
            {budgets.map((b) => (
              <li key={b.id}>
                <span className="text-slate-200">{b.name}</span>
                {b.isDefault ? " · default" : ""} · {b.currency}{" "}
                {Number(b.totalPlanned).toLocaleString()} · {b.lineCount} lines
                {b.generationSource ? ` · ${b.generationSource}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(data.ideas?.length ?? 0) > 0 && (
        <Section title={`Ideas (${data.ideas.length})`}>
          <ul className="space-y-1 text-[11px] text-slate-400">
            {data.ideas.map((idea: { id: string; title: string; logline: string | null; genres: string | null }) => (
              <li key={idea.id}>
                <span className="text-slate-200">{idea.title}</span>
                {idea.logline ? ` — ${idea.logline}` : ""}
                {idea.genres ? ` · ${idea.genres}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}

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
            {data.casting.map(
              (r: { role: string; status: string; description: string | null; dailyRate?: number | null }) => (
                <li key={r.role}>
                  <span className="text-slate-200">{r.role}</span> · {r.status}
                  {r.dailyRate != null ? ` · R${r.dailyRate}/day` : ""}
                  {r.description ? ` — ${r.description}` : ""}
                </li>
              ),
            )}
          </ul>
        </Section>
      )}

      {(data.crew?.length ?? 0) > 0 && (
        <Section title={`Crew needs (${data.crew.length})`}>
          <ul className="space-y-1 text-[11px] text-slate-400">
            {data.crew.map(
              (n: {
                role: string;
                department: string | null;
                notes: string | null;
                dailyRate?: number | null;
              }) => (
                <li key={n.role}>
                  <span className="text-slate-200">{n.role}</span>
                  {n.department ? ` · ${n.department}` : ""}
                  {n.dailyRate != null ? ` · R${n.dailyRate}/day` : ""}
                  {n.notes ? ` · ${n.notes}` : ""}
                </li>
              ),
            )}
          </ul>
        </Section>
      )}

      {(data.footage?.length ?? 0) > 0 && (
        <Section title={`Footage & assets (${data.footage.length})`}>
          <ul className="space-y-1 text-[11px]">
            {data.footage.map((f: { id: string; label: string | null; type: string; fileUrl: string }) => (
              <li key={f.id}>
                <SecureFileLink fileRef={f.fileUrl} label={f.label || f.type} context="admin" />
                <span className="text-slate-500"> · {f.type}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(data.music?.length ?? 0) > 0 && (
        <Section title={`Music selections (${data.music.length})`}>
          <ul className="space-y-1 text-[11px] text-slate-400">
            {data.music.map(
              (m: {
                id: string;
                trackTitle: string;
                artist: string | null;
                usage: string | null;
                notes: string | null;
              }) => (
                <li key={m.id}>
                  <span className="text-slate-200">{m.trackTitle}</span>
                  {m.artist ? ` · ${m.artist}` : ""}
                  {m.usage ? ` · ${m.usage}` : ""}
                  {m.notes ? ` — ${m.notes}` : ""}
                </li>
              ),
            )}
          </ul>
        </Section>
      )}

      {(data.visualAssets?.length ?? 0) > 0 && (
        <Section title={`Visual assets (${data.visualAssets.length})`}>
          <ul className="space-y-1 text-[11px]">
            {data.visualAssets.map(
              (a: {
                id: string;
                title: string | null;
                category: string;
                imageUrl: string;
                caption: string | null;
              }) => (
                <li key={a.id}>
                  <SecureFileLink fileRef={a.imageUrl} label={a.title || a.category} context="admin" />
                  <span className="text-slate-500"> · {a.category}</span>
                  {a.caption ? <span className="text-slate-500"> — {a.caption}</span> : null}
                </li>
              ),
            )}
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
            {data.postProductionReviews.map(
              (r: { id: string; status: string; notes: { body: string }[]; createdAt?: string }) => (
                <li key={r.id}>
                  {r.status}
                  {r.notes?.length ? ` — ${r.notes.map((n) => n.body).join("; ")}` : ""}
                </li>
              ),
            )}
          </ul>
        </Section>
      )}

      {linked.length > 0 && (
        <Section title="Linked catalogue submissions" defaultOpen>
          <ul className="space-y-3 text-[11px]">
            {linked.map((c) => (
              <li key={c.id} className="space-y-1 text-slate-300">
                <p>
                  <Link href={`/admin/content?highlight=${c.id}`} className="text-white hover:underline">
                    {c.title}
                  </Link>{" "}
                  · {c.reviewStatus}
                  {c.videoUrl ? (
                    <>
                      {" "}
                      · <SecureFileLink fileRef={c.videoUrl} label="Watch master" context="admin" />
                    </>
                  ) : null}
                  {c.scriptUrl ? (
                    <>
                      {" "}
                      · <SecureFileLink fileRef={c.scriptUrl} label="Uploaded script PDF" context="admin" />
                    </>
                  ) : null}
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
          <ul className="space-y-2 text-[11px] text-slate-400">
            {data.pitches.map(
              (p: {
                id: string;
                title: string;
                status: string;
                synopsis: string | null;
                logline?: string | null;
                budgetEst?: number | null;
                reviewWeightedScore?: number | null;
                creator?: { name: string | null; email: string | null; networkHandle: string | null };
              }) => (
                <li key={p.id} className="rounded border border-white/6 bg-black/15 px-2 py-1.5">
                  <span className="text-slate-200">{p.title}</span> · {p.status}
                  {p.creator ? ` · ${personLabel(p.creator)}` : ""}
                  {p.reviewWeightedScore != null ? ` · score ${p.reviewWeightedScore}` : ""}
                  {p.budgetEst != null ? ` · est. ${p.budgetEst}` : ""}
                  {p.logline ? (
                    <p className="mt-0.5 text-slate-500">{p.logline}</p>
                  ) : p.synopsis ? (
                    <p className="mt-0.5 text-slate-500">
                      {p.synopsis.slice(0, 160)}
                      {p.synopsis.length > 160 ? "…" : ""}
                    </p>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        </Section>
      )}
    </div>
  );
}
