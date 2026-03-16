"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Send, MessageCircle, ArrowLeft, Wrench, MapPin, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

interface Msg {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string | null; role: string };
}

interface Request {
  id: string;
  status: string;
  note: string | null;
  equipment: { companyName: string; category: string };
  company: { id: string; name: string | null };
  _count: { messages: number };
}

interface Booking {
  id: string;
  status: string;
  location: { name: string; type: string; city: string | null };
  owner: { id: string; name: string | null };
  _count: { messages: number };
}

interface CateringBooking {
  id: string;
  status: string;
  paymentTransactionId: string | null;
  cateringCompany: { companyName: string; userId: string };
}

export default function CreatorMessagesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const params = useSearchParams();
  const initialRequestId = params.get("requestId");
  const companyIdParam = params.get("companyId");
  const tabParam = params.get("tab");
  const bookingIdParam = params.get("bookingId");
  const cateringParam = params.get("catering");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cateringBookings, setCateringBookings] = useState<CateringBooking[]>([]);
  const [tab, setTab] = useState<"equipment" | "locations" | "catering">(cateringParam ? "catering" : tabParam === "locations" ? "locations" : "equipment");
  const [activeReqId, setActiveReqId] = useState<string | null>(initialRequestId);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(bookingIdParam);
  const [activeCateringId, setActiveCateringId] = useState<string | null>(cateringParam);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tabParam === "locations") setTab("locations");
    if (bookingIdParam) setActiveBookingId(bookingIdParam);
    if (cateringParam) { setTab("catering"); setActiveCateringId(cateringParam); }
  }, [tabParam, bookingIdParam, cateringParam]);

  useEffect(() => {
    fetch("/api/equipment-requests").then((r) => r.json()).then((reqs) => setRequests(reqs));
    fetch("/api/location-bookings").then((r) => r.json()).then((bks) => {
      setBookings(bks);
      if (tab === "locations" && !activeBookingId && bks.length > 0) setActiveBookingId(bks[0].id);
      if (bookingIdParam) setActiveBookingId(bookingIdParam);
    });
    fetch("/api/catering-bookings").then((r) => r.json()).then((bks) => {
      const list = Array.isArray(bks) ? bks.filter((b: CateringBooking) => b.paymentTransactionId) : [];
      setCateringBookings(list);
      if (cateringParam && list.some((b: CateringBooking) => b.id === cateringParam)) setActiveCateringId(cateringParam);
      else if (list.length > 0) setActiveCateringId((cur) => cur && list.some((b: CateringBooking) => b.id === cur) ? cur : list[0].id);
      setLoading(false);
    });
  }, [tab, cateringParam]);

  useEffect(() => {
    if (tab === "equipment" && activeReqId) {
      fetch(`/api/messages?requestId=${activeReqId}`).then((r) => r.json()).then(setMessages);
    } else if (tab === "locations" && activeBookingId) {
      fetch(`/api/messages?locationBookingId=${activeBookingId}`).then((r) => r.json()).then(setMessages);
    } else if (tab === "catering" && activeCateringId) {
      fetch(`/api/messages?cateringBookingId=${activeCateringId}`).then((r) => r.json()).then(setMessages);
    } else setMessages([]);
  }, [tab, activeReqId, activeBookingId, activeCateringId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeReq = requests.find((r) => r.id === activeReqId);
  const activeBooking = bookings.find((b) => b.id === activeBookingId);
  const activeCatering = cateringBookings.find((b) => b.id === activeCateringId);

  async function sendCateringMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !activeCatering) return;
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newMsg, receiverId: activeCatering.cateringCompany.userId, cateringBookingId: activeCateringId }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setNewMsg("");
    }
  }

  async function sendEquipmentMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !activeReq) return;
    const receiverId = companyIdParam || activeReq.company.id;
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newMsg, receiverId, requestId: activeReqId }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setNewMsg("");
    }
  }

  async function sendLocationMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !activeBooking) return;
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newMsg, receiverId: activeBooking.owner.id, locationBookingId: activeBookingId }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setNewMsg("");
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <main className="max-w-7xl mx-auto px-6 md:px-12 py-10">
      <div className="mb-6">
        <Link href="/creator/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-4 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-white">Messages</h1>
        <p className="text-slate-400 text-sm">Chat with equipment companies, location owners, and caterers</p>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setTab("equipment")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "equipment" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
            <Wrench className="w-4 h-4" /> Equipment
          </button>
          <button onClick={() => setTab("locations")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "locations" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
            <MapPin className="w-4 h-4" /> Locations
          </button>
          <button onClick={() => setTab("catering")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "catering" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
            <UtensilsCrossed className="w-4 h-4" /> Catering
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-320px)]">
        <div className="col-span-4 bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-y-auto">
          <div className="p-4 border-b border-slate-700/50">
            <h2 className="text-sm font-medium text-slate-300">{tab === "equipment" ? "Equipment Requests" : tab === "locations" ? "Location Bookings" : "Catering Bookings"}</h2>
          </div>
          {tab === "catering" ? (
            cateringBookings.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">No paid catering bookings yet. Pay for a booking in Catering to unlock messages.</div>
            ) : (
              cateringBookings.map((b) => (
                <button key={b.id} onClick={() => setActiveCateringId(b.id)} className={`w-full text-left p-4 border-b border-slate-700/30 transition ${activeCateringId === b.id ? "bg-orange-500/10 border-l-2 border-l-orange-500" : "hover:bg-slate-700/30"}`}>
                  <p className="text-white text-sm font-medium truncate">{b.cateringCompany.companyName}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${b.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" : "bg-slate-600/50 text-slate-400"}`}>{b.status}</span>
                </button>
              ))
            )
          ) : tab === "equipment" ? (
            requests.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">No equipment requests yet</div>
            ) : (
              requests.map((r) => (
                <button key={r.id} onClick={() => setActiveReqId(r.id)} className={`w-full text-left p-4 border-b border-slate-700/30 transition ${activeReqId === r.id ? "bg-orange-500/10 border-l-2 border-l-orange-500" : "hover:bg-slate-700/30"}`}>
                  <p className="text-white text-sm font-medium truncate">{r.equipment.category} — {r.equipment.companyName}</p>
                  <p className="text-xs text-slate-400">{r.company.name || "Company"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${r.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" : r.status === "APPROVED" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{r.status}</span>
                    <span className="text-xs text-slate-500">{r._count.messages} msgs</span>
                  </div>
                </button>
              ))
            )
          ) : bookings.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No location bookings yet</div>
          ) : (
            bookings.map((b) => (
              <button key={b.id} onClick={() => setActiveBookingId(b.id)} className={`w-full text-left p-4 border-b border-slate-700/30 transition ${activeBookingId === b.id ? "bg-orange-500/10 border-l-2 border-l-orange-500" : "hover:bg-slate-700/30"}`}>
                <p className="text-white text-sm font-medium truncate">{b.location.name} — {b.location.type}</p>
                <p className="text-xs text-slate-400">{b.owner.name || "Location owner"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${b.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" : b.status === "APPROVED" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{b.status}</span>
                  <span className="text-xs text-slate-500">{b._count.messages} msgs</span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="col-span-8 bg-slate-800/50 border border-slate-700/50 rounded-xl flex flex-col">
          {tab === "equipment" && activeReq ? (
            <>
              <div className="p-4 border-b border-slate-700/50">
                <p className="text-white font-medium">{activeReq.equipment.category} — {activeReq.equipment.companyName}</p>
                <p className="text-xs text-slate-400">with {activeReq.company.name || "Equipment Company"}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && <div className="text-center text-slate-500 text-sm py-10"><MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" /> No messages yet.</div>}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender.role === "CONTENT_CREATOR" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-xl px-4 py-2.5 ${m.sender.role === "CONTENT_CREATOR" ? "bg-orange-500/20 text-orange-100" : "bg-slate-700/50 text-slate-200"}`}>
                      <p className="text-xs font-medium mb-1 opacity-70">{m.sender.name || "Unknown"}</p>
                      <p className="text-sm">{m.body}</p>
                      <p className="text-xs opacity-50 mt-1">{new Date(m.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={sendEquipmentMessage} className="p-4 border-t border-slate-700/50 flex gap-3">
                <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Type your message..." className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />
                <button type="submit" className="px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"><Send className="w-4 h-4" /></button>
              </form>
            </>
          ) : tab === "locations" && activeBooking ? (
            <>
              <div className="p-4 border-b border-slate-700/50">
                <p className="text-white font-medium">{activeBooking.location.name} — {activeBooking.location.type}</p>
                <p className="text-xs text-slate-400">with {activeBooking.owner.name || "Location owner"}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && <div className="text-center text-slate-500 text-sm py-10"><MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" /> No messages yet.</div>}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender.role === "CONTENT_CREATOR" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-xl px-4 py-2.5 ${m.sender.role === "CONTENT_CREATOR" ? "bg-orange-500/20 text-orange-100" : "bg-slate-700/50 text-slate-200"}`}>
                      <p className="text-xs font-medium mb-1 opacity-70">{m.sender.name || "Unknown"}</p>
                      <p className="text-sm">{m.body}</p>
                      <p className="text-xs opacity-50 mt-1">{new Date(m.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={sendLocationMessage} className="p-4 border-t border-slate-700/50 flex gap-3">
                <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Type your message..." className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />
                <button type="submit" className="px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"><Send className="w-4 h-4" /></button>
              </form>
            </>
          ) : tab === "catering" && activeCatering ? (
            <>
              <div className="p-4 border-b border-slate-700/50">
                <p className="text-white font-medium">{activeCatering.cateringCompany.companyName}</p>
                <p className="text-xs text-slate-400">Catering booking</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && <div className="text-center text-slate-500 text-sm py-10"><MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" /> No messages yet.</div>}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender.role === "CONTENT_CREATOR" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-xl px-4 py-2.5 ${m.sender.role === "CONTENT_CREATOR" ? "bg-orange-500/20 text-orange-100" : "bg-slate-700/50 text-slate-200"}`}>
                      <p className="text-xs font-medium mb-1 opacity-70">{m.sender.name || "Unknown"}</p>
                      <p className="text-sm">{m.body}</p>
                      <p className="text-xs opacity-50 mt-1">{new Date(m.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={sendCateringMessage} className="p-4 border-t border-slate-700/50 flex gap-3">
                <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Type your message..." className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />
                <button type="submit" className="px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"><Send className="w-4 h-4" /></button>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">
              Select a {tab === "equipment" ? "request" : tab === "locations" ? "booking" : "catering booking"} to view messages
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
