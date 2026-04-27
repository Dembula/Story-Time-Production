"use client";

import { useEffect, useState } from "react";
import { Package, MessageCircle, Clock, CheckCircle, XCircle, TrendingUp, Wrench, DollarSign } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";

interface EquipmentRequest {
  id: string;
  status: string;
  note: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  equipment: { companyName: string; category: string; description: string | null };
  requester: { id: string; name: string | null; email: string | null };
  _count: { messages: number };
}

interface Listing {
  id: string;
  companyName: string;
  category: string;
  description: string | null;
}

export default function EquipmentDashboard() {
  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  const [subChecked, setSubChecked] = useState(false);
  useEffect(() => {
    fetch("/api/company-subscription").then((r) => r.json()).then((data) => {
      if (!data?.subscription?.id || data.subscription.status !== "ACTIVE") {
        window.location.href = "/company/onboarding/subscription";
        return;
      }
      setSubChecked(true);
    });
  }, []);
  useEffect(() => {
    if (!subChecked) return;
    Promise.all([
      fetch("/api/equipment-requests").then((r) => r.json()),
      fetch("/api/equipment").then((r) => r.json()),
      fetch("/api/equipment-company/stats").then((r) => r.json()),
    ]).then(([reqs, equip, stats]) => {
      setRequests(reqs);
      setListings(equip);
      setRevenue(typeof stats?.revenue === "number" ? stats.revenue : 0);
      setLoading(false);
    });
  }, [subChecked]);

  const pending = requests.filter((r) => r.status === "PENDING").length;
  const approved = requests.filter((r) => r.status === "APPROVED").length;
  const declined = requests.filter((r) => r.status === "DECLINED").length;
  const totalMessages = requests.reduce((acc, r) => acc + r._count.messages, 0);

  async function handleStatus(id: string, status: string) {
    await fetch("/api/equipment-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  }

  if (!subChecked || loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <main className="max-w-7xl mx-auto px-6 md:px-12 py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Equipment Dashboard</h1>
        <p className="text-slate-400 text-sm">Manage your equipment listings and creator requests</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Listings", value: listings.length, icon: Package, color: "text-blue-400" },
          { label: "Total Requests", value: requests.length, icon: TrendingUp, color: "text-orange-400" },
          { label: "Pending", value: pending, icon: Clock, color: "text-yellow-400" },
          { label: "Approved", value: approved, icon: CheckCircle, color: "text-green-400" },
          { label: "Messages", value: totalMessages, icon: MessageCircle, color: "text-purple-400" },
          { label: "Settled revenue", value: formatZar(revenue, { maximumFractionDigits: 0 }), icon: DollarSign, color: "text-emerald-400" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold ${s.label === "Settled revenue" ? "text-emerald-300" : "text-white"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-orange-400" /> Recent Equipment Requests
        </h2>
        {requests.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No equipment requests yet.</p>
            <p className="text-xs text-slate-500 mt-1">Film creators will be able to request equipment from your listings.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white font-medium">{r.equipment.category}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                        r.status === "APPROVED" ? "bg-green-500/10 text-green-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Requested by <span className="text-orange-400">{r.requester.name || r.requester.email}</span>
                    </p>
                    {r.note && <p className="text-sm text-slate-500 mt-1">&quot;{r.note}&quot;</p>}
                    {r.startDate && (
                      <p className="text-xs text-slate-500 mt-1">
                        {r.startDate} — {r.endDate || "Ongoing"}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {r._count.messages} message{r._count.messages !== 1 && "s"} &middot; {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleStatus(r.id, "APPROVED")}
                          className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStatus(r.id, "DECLINED")}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <a
                      href={`/equipment-company/messages?requestId=${r.id}`}
                      className="p-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
