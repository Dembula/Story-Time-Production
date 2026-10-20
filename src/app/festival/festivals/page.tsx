"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Film, Plus } from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";
import { FestivalEmptyPanel } from "@/components/festival/festival-empty-panel";
import { useFestivalList } from "@/components/festival/use-active-festival";

export default function FestivalFestivalsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [error, setError] = useState("");
  const { data: festivals = [], isLoading } = useFestivalList();

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/festival", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tagline }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create");
      return json.festival as { id: string };
    },
    onSuccess: (festival) => {
      qc.invalidateQueries({ queryKey: ["festival-list"] });
      window.location.href = `/festival/festivals/${festival.id}`;
    },
    onError: (e: Error) => setError(e.message),
  });

  const listingAction = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "unpublish" | "delete" }) => {
      const res = await fetch(`/api/festival/${id}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      return json;
    },
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["festival-list"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <OpsPageHeader title="My festivals" subtitle="Listings creators browse and submit to." />

      <OpsSection title="Create festival">
        <form
          className="cinematic-glass grid gap-4 rounded-2xl border border-white/8 p-5 shadow-panel sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            create.mutate();
          }}
        >
          <label className="block text-sm text-slate-300 sm:col-span-1">
            Festival name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-slate-950 px-3 text-white outline-none focus:border-orange-400/50"
              placeholder="Highlands Horrorfest"
              required
            />
          </label>
          <label className="block text-sm text-slate-300 sm:col-span-1">
            Tagline
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-slate-950 px-3 text-white outline-none focus:border-orange-400/50"
              placeholder="Stories from the mountains"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {create.isPending ? "Creating…" : "Create & continue setup"}
            </button>
            {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
          </div>
        </form>
      </OpsSection>

      <OpsSection title="All festivals">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : festivals.length === 0 ? (
          <FestivalEmptyPanel
            icon={Film}
            title="No festivals yet"
            body="Create a listing to configure poster, categories, and fees."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/8">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Festival</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Entries</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {festivals.map((f) => (
                  <tr key={f.id} className="border-t border-white/8">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-16 overflow-hidden rounded-lg bg-slate-900">
                          {f.headerImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.headerImageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Film className="h-4 w-4 text-slate-600" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">{f.name}</p>
                          <p className="text-xs text-slate-500">{f.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{f.status.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-slate-300">{f._count?.submissions ?? 0}</td>
                    <td className="px-4 py-3 text-slate-300">{f._count?.memberships ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/festival/festivals/${f.id}`}
                          className="text-orange-300 hover:text-orange-200"
                        >
                          Edit
                        </Link>
                        {f.status === "LIVE" || f.status === "SUBMISSIONS_CLOSED" ? (
                          <button
                            type="button"
                            disabled={listingAction.isPending}
                            onClick={() => {
                              if (
                                confirm(
                                  `Unpublish “${f.name}”? Creators will no longer see it until you publish again.`,
                                )
                              ) {
                                listingAction.mutate({ id: f.id, action: "unpublish" });
                              }
                            }}
                            className="text-amber-200/90 hover:text-amber-100"
                          >
                            Unpublish
                          </button>
                        ) : null}
                        {f.status !== "ENDED" ? (
                          <button
                            type="button"
                            disabled={listingAction.isPending}
                            onClick={() => {
                              if (
                                confirm(
                                  `Remove “${f.name}”? Only works with no paid submissions.`,
                                )
                              ) {
                                listingAction.mutate({ id: f.id, action: "delete" });
                              }
                            }}
                            className="text-red-300/90 hover:text-red-200"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </OpsSection>
    </div>
  );
}
