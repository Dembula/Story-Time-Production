"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Briefcase, Mail, Megaphone, DollarSign } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import { OpsMetricCard, OpsPageHeader, OpsQuickActions, OpsSection } from "@/components/ecosystem/ops-shell";

type Inquiry = {
  id: string;
  projectName: string | null;
  roleName: string | null;
  status: string;
  creator: { name: string | null };
};

type AuditionFeedItem = {
  id: string;
  roleName: string;
  description: string | null;
  status: string;
  createdAt: string;
  content: { title: string };
  creator: { id: string; name: string | null };
};

export function CastingDashboardClient() {
  const [agency, setAgency] = useState<{ id: string; agencyName: string; _count: { talent: number; inquiries: number } } | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [auditionFeed, setAuditionFeed] = useState<AuditionFeedItem[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/casting-agency").then((r) => r.json()),
      fetch("/api/casting-agency/inquiries").then((r) => r.json()),
      fetch("/api/auditions?scope=feed").then((r) => r.json()),
      fetch("/api/casting-agency/stats").then((r) => r.json()),
    ]).then(([a, inq, auds, stats]) => {
      setAgency(a);
      setInquiries(Array.isArray(inq) ? inq : []);
      setAuditionFeed(Array.isArray(auds) ? auds : []);
      setRevenue(typeof stats?.revenue === "number" ? stats.revenue : 0);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center min-h-[40vh]"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!agency) return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-8 text-center">
        <Briefcase className="w-12 h-12 text-violet-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Set up your agency profile</h2>
        <Link href="/casting-agency/profile" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600">Create profile</Link>
      </div>
    </div>
  );

  const pending = inquiries.filter((i) => i.status === "PENDING").length;
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <OpsPageHeader
        title={agency.agencyName}
        subtitle="Casting operations — talent roster, inbound inquiries, open auditions, and settled revenue."
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <OpsMetricCard label="Talent" value={agency._count.talent} icon={Users} accent="violet" />
        <OpsMetricCard label="Inquiries" value={agency._count.inquiries} icon={Mail} accent="orange" />
        <OpsMetricCard label="Pending" value={pending} accent="amber" />
        <OpsMetricCard
          label="Settled revenue"
          value={formatZar(revenue, { maximumFractionDigits: 0 })}
          icon={DollarSign}
          accent="emerald"
        />
      </div>

      <OpsQuickActions
        items={[
          { href: "/casting-agency/inquiries", label: "Requests & offers", description: "Respond to creator casting inquiries" },
          { href: "/casting-agency/talent", label: "Manage talent", description: "Roster, headshots, and availability" },
          { href: "/casting-agency/wallet", label: "Wallet", description: "Payouts and balances" },
        ]}
      />

      <div className="grid md:grid-cols-2 gap-6">
        <OpsSection title="Recent inquiries">
          <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 flex justify-between">
              <span className="text-sm text-slate-400">Latest inbound</span>
              <Link href="/casting-agency/inquiries" className="text-sm text-violet-400">View all</Link>
            </div>
            <div className="divide-y divide-slate-700/50">
              {inquiries.slice(0, 5).length === 0 ? <div className="p-8 text-center text-slate-500">No inquiries yet.</div> : inquiries.slice(0, 5).map((r) => (
                <div key={r.id} className="p-4 flex justify-between">
                  <div><p className="font-medium text-white">{r.projectName || "Project"}</p><p className="text-sm text-slate-400">{r.roleName} · {r.creator?.name}</p></div>
                  <span className={"px-3 py-1 rounded-full text-xs " + (r.status === "PENDING" ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400")}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        </OpsSection>

        <OpsSection title="Open auditions on Story Time">
          <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-violet-400" />
              <span className="text-sm text-slate-400">Platform feed</span>
            </div>
            <div className="divide-y divide-slate-700/50 max-h-[360px] overflow-y-auto">
              {auditionFeed.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No open auditions posted yet.</div>
              ) : auditionFeed.map((a) => (
                <div key={a.id} className="p-4 space-y-1">
                  <p className="font-medium text-white">{a.roleName}</p>
                  <p className="text-xs text-orange-400">for {a.content?.title}</p>
                  {a.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{a.description}</p>}
                  <p className="text-[11px] text-slate-500 mt-1">
                    Posted {new Date(a.createdAt).toLocaleDateString()} · by {a.creator?.name || "Creator"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </OpsSection>
      </div>
    </div>
  );
}
