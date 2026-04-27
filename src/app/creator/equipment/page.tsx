"use client";

import { useEffect, useState } from "react";
import { BackButton } from "@/components/layout/back-button";
import { Wrench, MapPin, ExternalLink, Send, Package, Clock, CheckCircle, MessageCircle, ArrowRight, CreditCard } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import { computeEquipmentRequestBaseZar } from "@/lib/equipment-request-base-zar";
import { computeMarketplaceFeeZar } from "@/lib/marketplace-zar-defaults";

type Equipment = {
  id: string;
  companyName: string;
  description: string | null;
  category: string;
  contactUrl: string | null;
  location: string | null;
  company: { id: string; name: string | null } | null;
};

type Request = {
  id: string;
  status: string;
  note: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  paymentTransactionId?: string | null;
  equipment: { companyName: string; category: string; description: string | null };
  company: { id: string; name: string | null };
  _count: { messages: number };
};

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"browse" | "requests">("browse");
  const [requesting, setRequesting] = useState<string | null>(null);
  const [form, setForm] = useState({ note: "", startDate: "", endDate: "" });
  const [success, setSuccess] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/equipment").then((r) => r.json()),
      fetch("/api/equipment-requests").then((r) => r.json()),
    ]).then(([equip, reqs]) => {
      setEquipment(equip);
      setRequests(reqs);
      setLoading(false);
    });
  }, []);

  const categories = [...new Set(equipment.map((e) => e.category))].sort();

  async function submitRequest(equipmentId: string) {
    const res = await fetch("/api/equipment-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equipmentId, ...form }),
    });
    if (res.ok) {
      const req = await res.json();
      setRequests((prev) => [
        {
          ...req,
          _count: { messages: 0 },
          company: equipment.find((e) => e.id === equipmentId)?.company || { id: "", name: "" },
          equipment: req.equipment ?? equipment.find((e) => e.id === equipmentId) ?? {
            companyName: "",
            category: "",
            description: null,
          },
        },
        ...prev,
      ]);
      setRequesting(null);
      setForm({ note: "", startDate: "", endDate: "" });
      setSuccess("Request sent successfully!");
      setTimeout(() => setSuccess(""), 3000);
    }
  }

  async function payRequest(requestId: string) {
    setPayingId(requestId);
    try {
      const res = await fetch(`/api/equipment-requests/${requestId}/pay`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSuccess("");
        alert(data?.error || "Payment failed");
        return;
      }
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, paymentTransactionId: data.transactionId ?? "paid" } : r,
        ),
      );
      const total = typeof data?.totalAmount === "number" ? formatZar(data.totalAmount) : "paid";
      setSuccess(`Payment recorded (${total} charged incl. platform fee).`);
      setTimeout(() => setSuccess(""), 5000);
    } finally {
      setPayingId(null);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <BackButton fallback="/creator/dashboard" />
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight flex items-center gap-3">
            <Wrench className="w-8 h-8 text-orange-500" />
            Equipment Repository
          </h1>
          <p className="text-slate-400">Browse equipment from companies on Story Time and send rental requests</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("browse")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "browse" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
            Browse Equipment
          </button>
          <button onClick={() => setTab("requests")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "requests" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
            My Requests ({requests.length})
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {success}
        </div>
      )}

      {tab === "browse" ? (
        <div className="space-y-10">
          {categories.map((category) => (
            <div key={category}>
              <h2 className="text-xl font-semibold text-white mb-4">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {equipment.filter((e) => e.category === category).map((e) => (
                  <div key={e.id} className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700/50 hover:border-orange-500/30 transition space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{e.companyName}</h3>
                        {e.company?.name && <p className="text-xs text-orange-400">{e.company.name}</p>}
                      </div>
                      <Package className="w-5 h-5 text-slate-600" />
                    </div>
                    {e.description && <p className="text-sm text-slate-400 leading-relaxed">{e.description}</p>}
                    <div className="flex flex-wrap gap-3 text-xs">
                      {e.location && <span className="flex items-center gap-1 text-slate-500"><MapPin className="w-3 h-3" /> {e.location}</span>}
                      {e.contactUrl && <a href={e.contactUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-orange-400 hover:text-orange-300"><ExternalLink className="w-3 h-3" /> Website</a>}
                    </div>

                    {e.company?.id ? (
                      requesting === e.id ? (
                        <div className="mt-3 space-y-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                          <textarea
                            value={form.note}
                            onChange={(ev) => setForm({ ...form, note: ev.target.value })}
                            placeholder="Note for the company (optional)"
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={form.startDate} onChange={(ev) => setForm({ ...form, startDate: ev.target.value })} className="px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm" />
                            <input type="date" value={form.endDate} onChange={(ev) => setForm({ ...form, endDate: ev.target.value })} className="px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => submitRequest(e.id)} className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition flex items-center justify-center gap-1.5">
                              <Send className="w-3.5 h-3.5" /> Send Request
                            </button>
                            <button onClick={() => setRequesting(null)} className="px-3 py-2 bg-slate-700/50 text-slate-400 rounded-lg text-sm hover:bg-slate-600/50 transition">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setRequesting(e.id)} className="w-full mt-2 py-2 rounded-lg text-sm font-medium bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 transition flex items-center justify-center gap-1.5">
                          <Send className="w-3.5 h-3.5" /> Request Equipment
                        </button>
                      )
                    ) : (
                      <p className="text-xs text-slate-600 mt-2 italic">Not available for direct requests</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No equipment requests yet.</p>
              <button onClick={() => setTab("browse")} className="mt-3 text-orange-400 text-sm hover:underline">Browse equipment</button>
            </div>
          ) : (
            requests.map((r) => {
              const base = computeEquipmentRequestBaseZar({
                equipmentDescription: r.equipment.description,
                startDate: r.startDate,
                endDate: r.endDate,
              });
              const fee = computeMarketplaceFeeZar(base);
              const estTotal = Math.round((base + fee) * 100) / 100;
              const canPay = r.status === "APPROVED" && !r.paymentTransactionId;
              const paid = Boolean(r.paymentTransactionId);
              return (
              <div key={r.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-white font-medium">{r.equipment.companyName} — {r.equipment.category}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                        r.status === "APPROVED" ? "bg-green-500/10 text-green-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>{r.status}</span>
                      {paid && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Paid</span>}
                    </div>
                    <p className="text-sm text-slate-400">To: <span className="text-orange-400">{r.company.name || "Company"}</span></p>
                    {r.note && <p className="text-sm text-slate-500 mt-1 italic">&quot;{r.note}&quot;</p>}
                    {r.startDate && <p className="text-xs text-slate-500 mt-1">Dates: {r.startDate} — {r.endDate || "TBD"}</p>}
                    <p className="text-xs text-slate-500 mt-1">{r._count.messages} messages &middot; {new Date(r.createdAt).toLocaleDateString()}</p>
                    {canPay && (
                      <p className="text-xs text-slate-400 mt-2">
                        Estimated checkout: {formatZar(base)} + fee {formatZar(fee)} = <span className="text-orange-300 font-medium">{formatZar(estTotal)}</span> (simulated gateway)
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:items-end gap-2 shrink-0">
                    <a href={`/creator/messages?requestId=${r.id}&companyId=${r.company.id}`} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition text-sm">
                      <MessageCircle className="w-4 h-4" /> Chat <ArrowRight className="w-3 h-3" />
                    </a>
                    {canPay && (
                      <button
                        type="button"
                        disabled={payingId === r.id}
                        onClick={() => payRequest(r.id)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition text-sm font-medium disabled:opacity-50"
                      >
                        <CreditCard className="w-4 h-4" /> {payingId === r.id ? "Processing…" : "Pay now"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );})
          )}
        </div>
      )}
    </div>
  );
}
