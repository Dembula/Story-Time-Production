"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";

export default function CastingAgencyInquiriesPage() {
  const [inquiries, setInquiries] = useState<{ id: string; projectName: string | null; roleName: string | null; message: string | null; status: string; createdAt: string; creator: { name: string | null; email: string | null } }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/casting-agency/inquiries").then((r) => r.json()).then((arr) => { setInquiries(Array.isArray(arr) ? arr : []); setLoading(false); });
  }, []);

  if (loading) return <div className="flex justify-center min-h-[40vh]"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/casting-agency/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <h1 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2"><Mail className="w-7 h-7 text-orange-500" /> Inquiries from creators</h1>
      {inquiries.length === 0 ? <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-8 text-center text-slate-500">No inquiries yet.</div> : (
        <div className="space-y-4">
          {inquiries.map((r) => (
            <div key={r.id} className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700/50">
              <p className="font-semibold text-white">{r.projectName || "Project"}</p>
              {r.roleName && <p className="text-sm text-violet-400">Role: {r.roleName}</p>}
              <p className="text-sm text-slate-400">{r.creator?.name || r.creator?.email}</p>
              {r.message && <p className="text-sm text-slate-500 mt-2">{r.message}</p>}
              <p className="text-xs text-slate-600 mt-2">{new Date(r.createdAt).toLocaleString()}</p>
              <span className={"inline-block mt-2 px-3 py-1 rounded-full text-xs " + (r.status === "PENDING" ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400")}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
