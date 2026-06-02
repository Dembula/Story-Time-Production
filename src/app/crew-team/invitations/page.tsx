"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { readCompanyApiJson } from "@/lib/casting-agency-client";

type Invitation = {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  project: { title: string } | null;
  need: { role: string; department: string | null } | null;
  crewMember: { name: string; photoUrl: string | null } | null;
  creator: { name: string | null; email: string | null };
};

export default function CrewTeamInvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/crew-team/invitations")
      .then((r) => readCompanyApiJson<Invitation[]>(r))
      .then(({ data, error: err }) => {
        if (err) setError(err);
        setInvitations(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <Link href="/crew-team/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-semibold text-white">
        <ClipboardList className="h-7 w-7 text-emerald-500" /> Project invitations
      </h1>
      <p className="mb-6 text-sm text-slate-400">Formal crew invites from creators working on specific film projects.</p>
      {error && <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{error}</div>}
      {invitations.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-10 text-center text-slate-500">No project invitations yet.</div>
      ) : (
        <div className="space-y-3">
          {invitations.map((inv) => (
            <div key={inv.id} className="flex gap-4 rounded-xl border border-slate-700/50 bg-slate-800/40 p-4">
              {inv.crewMember?.photoUrl ? (
                <img src={inv.crewMember.photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-700/50 text-slate-500">
                  <ClipboardList className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{inv.project?.title || "Project invitation"}</p>
                <p className="text-sm text-emerald-300">
                  {[inv.need?.role, inv.crewMember?.name].filter(Boolean).join(" · ")}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  From {inv.creator?.name || inv.creator?.email || "Creator"} · {new Date(inv.createdAt).toLocaleString()}
                </p>
                {inv.message && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{inv.message}</p>}
              </div>
              <span className="h-fit rounded-full bg-slate-700/60 px-3 py-1 text-xs text-slate-200">{inv.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
