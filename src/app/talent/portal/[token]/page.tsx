"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { resolveRenderableFileSource } from "@/lib/secure-file-preview-path";

export default function TalentPortalPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<{
    talent: { name: string; agencyName: string; headshotUrl: string | null };
    availability: Array<{ status: string; startDate: string | null; endDate: string | null; projectLabel: string | null }>;
    contracts: Array<{ status: string; type: string; projectTitle: string | null }>;
    invitations: Array<{ status: string; projectTitle: string | null; roleName: string }>;
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/talent/portal/${token}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) {
          setData({
            talent: { name: "", agencyName: "", headshotUrl: null },
            availability: [],
            contracts: [],
            invitations: [],
            error: json.error ?? "Invalid or expired link",
          });
          return;
        }
        setData(json);
      })
      .catch(() =>
        setData({
          talent: { name: "", agencyName: "", headshotUrl: null },
          availability: [],
          contracts: [],
          invitations: [],
          error: "Could not load",
        }),
      );
  }, [token]);

  if (!data) return <div className="p-8 text-center text-slate-400">Loading your portal…</div>;
  if (data.error) return <div className="p-8 text-center text-red-400">{data.error}</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6 md:p-10">
      <header className="flex items-start gap-4">
        {data.talent.headshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveRenderableFileSource(data.talent.headshotUrl, { portalToken: token }) ?? ""}
            alt=""
            className="h-20 w-20 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-800 text-2xl text-orange-300">
            {data.talent.name.slice(0, 1)}
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-wide text-orange-300/80">Talent portal · {data.talent.agencyName}</p>
          <h1 className="text-2xl font-semibold text-white">{data.talent.name}</h1>
          <p className="mt-1 text-sm text-slate-400">Managed by your agency — view schedule, contracts, and casting activity.</p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Availability</h2>
        {data.availability.length === 0 ? (
          <p className="text-sm text-slate-500">No blocks on file.</p>
        ) : (
          data.availability.map((a, i) => (
            <div key={i} className="rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-300">
              {a.status} · {a.projectLabel ?? "General"}
              {a.startDate && <span className="text-slate-500"> · {a.startDate.slice(0, 10)}</span>}
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Contracts</h2>
        {data.contracts.length === 0 ? (
          <p className="text-sm text-slate-500">No contracts yet.</p>
        ) : (
          data.contracts.map((c) => (
            <div key={c.type + c.projectTitle} className="flex justify-between rounded-lg border border-slate-800 px-3 py-2 text-xs">
              <span className="text-slate-200">{c.projectTitle ?? c.type}</span>
              <span className="text-slate-500">{c.status}</span>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Casting invitations</h2>
        {data.invitations.length === 0 ? (
          <p className="text-sm text-slate-500">No active invitations.</p>
        ) : (
          data.invitations.map((i) => (
            <div key={i.roleName + i.projectTitle} className="flex justify-between rounded-lg border border-slate-800 px-3 py-2 text-xs">
              <span className="text-slate-200">{i.projectTitle} · {i.roleName}</span>
              <span className="text-slate-500">{i.status}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
