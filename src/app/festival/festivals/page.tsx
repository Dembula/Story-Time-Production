"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function FestivalFestivalsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["festival-list"],
    queryFn: () => fetch("/api/festival").then((r) => r.json()),
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/festival", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">My festivals</h1>
        <p className="mt-1 text-sm text-slate-400">Create and configure festival listings that appear to Story Time creators.</p>
      </div>

      <form
        className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          create.mutate();
        }}
      >
        <label className="flex-1 text-sm text-slate-300">
          Festival name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-amber-500/50"
            placeholder="Highlands Horrorfest"
            required
          />
        </label>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
        >
          {create.isPending ? "Creating…" : "Create festival"}
        </button>
      </form>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {(data?.festivals ?? []).map((f: { id: string; name: string; status: string; slug: string }) => (
            <li key={f.id}>
              <Link
                href={`/festival/festivals/${f.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3 transition hover:border-amber-500/30"
              >
                <span className="font-medium text-white">{f.name}</span>
                <span className="text-xs uppercase text-slate-500">{f.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
