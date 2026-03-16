"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UtensilsCrossed, Calendar, DollarSign, AlertCircle } from "lucide-react";

type Company = { id: string; companyName: string; tagline: string | null } | null;

export function CateringDashboardClient() {
  const [company, setCompany] = useState<Company>(null);
  const [bookingCount, setBookingCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/catering-company/profile").then((r) => r.json()),
      fetch("/api/catering-bookings").then((r) => r.json()).then((b) => Array.isArray(b) ? b.length : 0),
      fetch("/api/catering-company/stats").then((r) => r.json()).then((s) => s.revenue ?? 0),
    ]).then(([c, count, rev]) => {
      setCompany(c);
      setBookingCount(count);
      setRevenue(rev);
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
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <UtensilsCrossed className="w-8 h-8 text-orange-500" /> Dashboard
        </h1>
        <p className="text-slate-400">Overview of your catering company</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-orange-400" /><span className="text-xs text-slate-400">Bookings</span></div>
          <p className="text-2xl font-bold text-white">{bookingCount}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-emerald-400" /><span className="text-xs text-slate-400">Revenue (ZAR)</span></div>
          <p className="text-2xl font-bold text-white">R{revenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick links</h2>
        <div className="flex flex-wrap gap-4">
          <Link href="/catering-company/profile" className="px-4 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition text-sm font-medium">Edit profile</Link>
          <Link href="/catering-company/bookings" className="px-4 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition text-sm font-medium">View bookings</Link>
          <Link href="/catering-company/messages" className="px-4 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition text-sm font-medium">Messages</Link>
          <Link href="/catering-company/revenue" className="px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition text-sm font-medium">Revenue & banking</Link>
        </div>
      </div>
    </div>
  );
}
