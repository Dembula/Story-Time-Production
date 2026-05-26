"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Calendar, DollarSign, AlertCircle } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import { OpsMetricCard, OpsPageHeader, OpsQuickActions } from "@/components/ecosystem/ops-shell";

type Company = { id: string; companyName: string; tagline: string | null } | null;

export function CateringDashboardClient() {
  const [company, setCompany] = useState<Company>(null);
  const [bookingCount, setBookingCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [revenueReportingNote, setRevenueReportingNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/catering-company/profile").then((r) => r.json()),
      fetch("/api/catering-bookings").then((r) => r.json()).then((b) => Array.isArray(b) ? b.length : 0),
      fetch("/api/catering-company/stats").then((r) => r.json()),
    ]).then(([c, count, stats]) => {
      setCompany(c);
      setBookingCount(count);
      const s = stats as { revenue?: number; reporting?: { note?: string } };
      setRevenue(s.revenue ?? 0);
      setRevenueReportingNote(typeof s.reporting?.note === "string" ? s.reporting.note : null);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 flex justify-center min-h-[40vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (!company) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-8 flex items-start gap-4">
          <AlertCircle className="w-10 h-10 text-amber-400 flex-shrink-0" />
          <div>
            <h2 className="text-xl font-semibold text-white mb-2">Complete your profile</h2>
            <p className="text-slate-400 mb-4">Add your catering company details to appear in the creator directory and receive bookings.</p>
            <Link href="/catering-company/profile" className="inline-flex px-5 py-2.5 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition">
              Set up profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <OpsPageHeader
        title={company.companyName}
        subtitle={company.tagline || "Catering marketplace operations — bookings, messaging, and settled revenue."}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <OpsMetricCard label="Bookings" value={bookingCount} icon={Calendar} accent="orange" />
        <OpsMetricCard
          label="Revenue (ZAR)"
          value={formatZar(revenue)}
          icon={DollarSign}
          accent="emerald"
          sub={revenueReportingNote ?? undefined}
        />
      </div>

      <OpsQuickActions
        items={[
          { href: "/catering-company/bookings", label: "Bookings & offers", description: "Confirm shoot catering requests" },
          { href: "/catering-company/profile", label: "Edit profile", description: "Directory listing and menus" },
          { href: "/catering-company/revenue", label: "Revenue & banking", description: "Settlements and reporting" },
          { href: "/catering-company/messages", label: "Messages", description: "Creator conversations" },
          { href: "/catering-company/wallet", label: "Wallet", description: "Payouts and balances" },
        ]}
      />
    </div>
  );
}
