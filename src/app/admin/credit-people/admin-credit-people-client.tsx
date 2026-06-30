"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GitMerge, RefreshCw, Search, UserCircle2 } from "lucide-react";

type CreditPersonRow = {
  id: string;
  displayName: string;
  normalizedName: string;
  userId: string | null;
  imageUrl: string | null;
  creditCount: number;
  linkedUser: { id: string; name: string | null; email: string | null } | null;
};

export function AdminCreditPeopleClient() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<CreditPersonRow[]>([]);
  const [unlinkedCrew, setUnlinkedCrew] = useState(0);
  const [loading, setLoading] = useState(true);
  const [keepId, setKeepId] = useState<string | null>(null);
  const [mergeId, setMergeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (q = query) => {
    setLoading(true);
    try {
      const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`/api/admin/credit-people${params}`);
      const data = await res.json();
      if (res.ok) {
        setPeople(data.people ?? []);
        setUnlinkedCrew(data.unlinkedCrew ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load("");
  }, [load]);

  async function runBackfill() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credit-people/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 200 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Backfill failed");
        return;
      }
      setMessage(`Linked ${data.linked} crew rows. ${data.remaining} still unlinked.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runMerge() {
    if (!keepId || !mergeId || keepId === mergeId) {
      setMessage("Select two different profiles to merge.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credit-people/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepPersonId: keepId, mergePersonId: mergeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Merge failed");
        return;
      }
      setMessage("Profiles merged successfully.");
      setKeepId(null);
      setMergeId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div>
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-semibold text-white">
          <UserCircle2 className="h-8 w-8 text-orange-400" />
          Credit identities
        </h1>
        <p className="text-slate-400">
          Search credited people, link duplicates, and backfill crew rows without a credit profile.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Credit profiles</p>
          <p className="text-2xl font-bold text-white">{people.length}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Unlinked crew rows</p>
          <p className="text-2xl font-bold text-white">{unlinkedCrew}</p>
        </div>
        <div className="flex items-center rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <button
            type="button"
            disabled={busy || unlinkedCrew === 0}
            onClick={() => void runBackfill()}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Backfill crew links
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load(query);
            }}
            placeholder="Search by name…"
            className="w-full rounded-lg border border-slate-700/50 bg-slate-900/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500"
          />
        </div>
        <button
          type="button"
          onClick={() => void load(query)}
          className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Search
        </button>
      </div>

      {message ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
          {message}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <GitMerge className="h-4 w-4 text-orange-400" />
          Merge duplicates
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Keep the profile you want to preserve; the other will be merged into it and deleted.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={keepId ?? ""}
            onChange={(e) => setKeepId(e.target.value || null)}
            className="min-w-[12rem] rounded-lg border border-slate-700/50 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="">Keep profile…</option>
            {people.map((p) => (
              <option key={`keep-${p.id}`} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
          <select
            value={mergeId ?? ""}
            onChange={(e) => setMergeId(e.target.value || null)}
            className="min-w-[12rem] rounded-lg border border-slate-700/50 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="">Merge away…</option>
            {people.map((p) => (
              <option key={`merge-${p.id}`} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !keepId || !mergeId}
            onClick={() => void runMerge()}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            Merge
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700/50">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Creator account</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {people.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No credit profiles found.
                  </td>
                </tr>
              ) : (
                people.map((p) => (
                  <tr key={p.id} className="bg-slate-900/20 hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{p.displayName}</p>
                      <p className="text-xs text-slate-500">{p.normalizedName}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{p.creditCount}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {p.linkedUser ? (
                        <span>
                          {p.linkedUser.name ?? p.linkedUser.email}
                          <span className="block text-xs text-slate-500">{p.linkedUser.email}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/browse/people/${p.id}`}
                        className="text-xs text-orange-300 hover:text-orange-200"
                      >
                        View profile
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
