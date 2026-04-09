"use client";

import { useEffect, useState, useRef, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Send, MessageCircle, ArrowLeft, Wrench, MapPin, UtensilsCrossed, Users, Search } from "lucide-react";
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

type InboxTab = "equipment" | "locations" | "catering" | "network";

function MessageBubble({ msg, isSelf }: { msg: Msg; isSelf: boolean }) {
  return (
    <div className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[min(100%,28rem)] rounded-xl px-4 py-2.5 ${
          isSelf ? "bg-orange-500/20 text-orange-100" : "creator-glass-panel text-slate-200 border border-white/8"
        }`}
      >
        <p className="text-xs font-medium mb-1 opacity-70">{msg.sender.name || "Unknown"}</p>
        <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
        <p className="text-xs opacity-50 mt-1">{new Date(msg.createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

function MessageThread({
  messages,
  selfId,
  bottomRef,
  emptyLabel,
}: {
  messages: Msg[];
  selfId: string | null;
  bottomRef: React.Ref<HTMLDivElement>;
  emptyLabel: string;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
      {messages.length === 0 ? (
        <div className="text-center text-slate-500 text-sm py-10">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          {emptyLabel}
        </div>
      ) : (
        messages.map((m) => <MessageBubble key={m.id} msg={m} isSelf={Boolean(selfId && m.sender.id === selfId)} />)
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export default function CreatorMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const params = useSearchParams();
  const router = useRouter();
  const skipUrlSync = useRef(true);

  const initialRequestId = params.get("requestId");
  const companyIdParam = params.get("companyId");
  const tabParam = params.get("tab");
  const bookingIdParam = params.get("bookingId");
  const cateringParam = params.get("catering");
  const withParam = params.get("with");

  const initialTab: InboxTab = withParam
    ? "network"
    : cateringParam
      ? "catering"
      : tabParam === "locations"
        ? "locations"
        : "equipment";

  const [messages, setMessages] = useState<Msg[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cateringBookings, setCateringBookings] = useState<CateringBooking[]>([]);
  const [tab, setTab] = useState<InboxTab>(initialTab);
  const [activeReqId, setActiveReqId] = useState<string | null>(initialRequestId);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(bookingIdParam);
  const [activeCateringId, setActiveCateringId] = useState<string | null>(cateringParam);
  const [peerId, setPeerId] = useState<string | null>(withParam);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState("");
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const syncUrl = useCallback(() => {
    const q = new URLSearchParams();
    q.set("tab", tab);
    if (tab === "equipment") {
      if (activeReqId) q.set("requestId", activeReqId);
      if (companyIdParam) q.set("companyId", companyIdParam);
    }
    if (tab === "locations" && activeBookingId) q.set("bookingId", activeBookingId);
    if (tab === "catering" && activeCateringId) q.set("catering", activeCateringId);
    if (tab === "network" && peerId) q.set("with", peerId);
    router.replace(`/creator/messages?${q.toString()}`, { scroll: false });
  }, [tab, activeReqId, activeBookingId, activeCateringId, peerId, companyIdParam, router]);

  useEffect(() => {
    if (skipUrlSync.current) {
      skipUrlSync.current = false;
      return;
    }
    syncUrl();
  }, [syncUrl]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((u) => (u?.id ? setSelfId(u.id) : null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tabParam === "locations") setTab("locations");
    if (bookingIdParam) setActiveBookingId(bookingIdParam);
    if (cateringParam) {
      setTab("catering");
      setActiveCateringId(cateringParam);
    }
    if (withParam) {
      setTab("network");
      setPeerId(withParam);
    }
  }, [tabParam, bookingIdParam, cateringParam, withParam]);

  useEffect(() => {
    fetch("/api/equipment-requests")
      .then((r) => r.json())
      .then((reqs) => setRequests(Array.isArray(reqs) ? reqs : []));
    fetch("/api/location-bookings")
      .then((r) => r.json())
      .then((bks) => setBookings(Array.isArray(bks) ? bks : []));
    fetch("/api/catering-bookings")
      .then((r) => r.json())
      .then((bks) => {
        const list = Array.isArray(bks) ? bks.filter((b: CateringBooking) => b.paymentTransactionId) : [];
        setCateringBookings(list);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (tab !== "equipment" || requests.length === 0) return;
    setActiveReqId((id) => {
      if (id && requests.some((r) => r.id === id)) return id;
      if (initialRequestId && requests.some((r) => r.id === initialRequestId)) return initialRequestId;
      return requests[0].id;
    });
  }, [tab, requests, initialRequestId]);

  useEffect(() => {
    if (tab !== "locations" || bookings.length === 0) return;
    setActiveBookingId((id) => {
      if (id && bookings.some((b) => b.id === id)) return id;
      if (bookingIdParam && bookings.some((b) => b.id === bookingIdParam)) return bookingIdParam;
      return bookings[0].id;
    });
  }, [tab, bookings, bookingIdParam]);

  useEffect(() => {
    if (tab !== "catering" || cateringBookings.length === 0) return;
    setActiveCateringId((id) => {
      if (id && cateringBookings.some((b) => b.id === id)) return id;
      if (cateringParam && cateringBookings.some((b) => b.id === cateringParam)) return cateringParam;
      return cateringBookings[0].id;
    });
  }, [tab, cateringBookings, cateringParam]);

  useEffect(() => {
    if (tab === "equipment" && activeReqId) {
      fetch(`/api/messages?requestId=${activeReqId}`).then((r) => r.json()).then(setMessages);
    } else if (tab === "locations" && activeBookingId) {
      fetch(`/api/messages?locationBookingId=${activeBookingId}`).then((r) => r.json()).then(setMessages);
    } else if (tab === "catering" && activeCateringId) {
      fetch(`/api/messages?cateringBookingId=${activeCateringId}`).then((r) => r.json()).then(setMessages);
    } else if (tab === "network" && peerId) {
      fetch(`/api/messages?peerId=${peerId}`).then((r) => r.json()).then(setMessages);
    } else setMessages([]);
  }, [tab, activeReqId, activeBookingId, activeCateringId, peerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (tab !== "network" || !peerId) {
      setPeerName(null);
      return;
    }
    fetch(`/api/network/profile/${peerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPeerName(d?.user?.name ?? "Creator"))
      .catch(() => setPeerName("Creator"));
  }, [tab, peerId]);

  const activeReq = requests.find((r) => r.id === activeReqId);
  const activeBooking = bookings.find((b) => b.id === activeBookingId);
  const activeCatering = cateringBookings.find((b) => b.id === activeCateringId);

  const q = listFilter.trim().toLowerCase();
  const filteredRequests = q
    ? requests.filter(
        (r) =>
          r.equipment.category.toLowerCase().includes(q) ||
          r.equipment.companyName.toLowerCase().includes(q) ||
          (r.company.name?.toLowerCase().includes(q) ?? false) ||
          (r.note?.toLowerCase().includes(q) ?? false),
      )
    : requests;
  const filteredBookings = q
    ? bookings.filter(
        (b) =>
          b.location.name.toLowerCase().includes(q) ||
          b.location.type.toLowerCase().includes(q) ||
          (b.owner.name?.toLowerCase().includes(q) ?? false) ||
          (b.location.city?.toLowerCase().includes(q) ?? false),
      )
    : bookings;
  const filteredCatering = q
    ? cateringBookings.filter((b) => b.cateringCompany.companyName.toLowerCase().includes(q))
    : cateringBookings;

  function selectTab(next: InboxTab) {
    setTab(next);
  }

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

  async function sendNetworkMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !peerId) return;
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newMsg, receiverId: peerId }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setNewMsg("");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabButtons: { id: InboxTab; label: string; icon: typeof Wrench }[] = [
    { id: "equipment", label: "Equipment", icon: Wrench },
    { id: "locations", label: "Locations", icon: MapPin },
    { id: "catering", label: "Catering", icon: UtensilsCrossed },
    { id: "network", label: "Direct", icon: Users },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-10 space-y-6">
      <Link href="/creator/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Inbox</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl">Messages</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400 md:text-base">
          Equipment, locations, catering, and direct messages with creators you open from Network.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabButtons.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                tab === id
                  ? "bg-orange-500 text-white shadow-glow"
                  : "border border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:min-h-[min(70vh,720px)]">
        <div className="creator-glass-panel flex max-h-[40vh] flex-col overflow-hidden rounded-2xl border border-white/10 lg:col-span-4 lg:max-h-none">
          <div className="shrink-0 space-y-3 border-b border-white/8 p-4">
            <h2 className="text-sm font-medium text-slate-200">
              {tab === "equipment"
                ? "Equipment requests"
                : tab === "locations"
                  ? "Location bookings"
                  : tab === "catering"
                    ? "Catering bookings"
                    : "Direct"}
            </h2>
            {tab !== "network" && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={listFilter}
                  onChange={(e) => setListFilter(e.target.value)}
                  placeholder="Search…"
                  className="storytime-input w-full py-2 pl-9 pr-3 text-sm"
                />
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "network" ? (
              peerId ? (
                <div className="w-full border-b border-white/8 bg-orange-500/10 p-4 text-left">
                  <p className="truncate text-sm font-medium text-white">{peerName || "…"}</p>
                  <p className="text-xs text-slate-400">Direct message</p>
                </div>
              ) : (
                <div className="storytime-empty-state m-4 p-6 text-center text-sm text-slate-400">
                  <p className="mb-3">Open a creator profile and use <strong className="text-slate-300">Message</strong> to start a thread.</p>
                  <Link href="/creator/network" className="text-orange-400 hover:text-orange-300">
                    Go to Network →
                  </Link>
                </div>
              )
            ) : tab === "catering" ? (
              filteredCatering.length === 0 ? (
                <div className="storytime-empty-state m-4 p-6 text-center text-sm text-slate-500">
                  No paid catering bookings. Pay for a booking in Catering to unlock messages.
                </div>
              ) : (
                filteredCatering.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setActiveCateringId(b.id)}
                    className={`w-full border-b border-white/6 p-4 text-left transition last:border-0 ${
                      activeCateringId === b.id ? "bg-orange-500/10 border-l-2 border-l-orange-500" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <p className="truncate text-sm font-medium text-white">{b.cateringCompany.companyName}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          b.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" : "bg-white/[0.06] text-slate-400"
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                  </button>
                ))
              )
            ) : tab === "equipment" ? (
              filteredRequests.length === 0 ? (
                <div className="storytime-empty-state m-4 p-6 text-center text-sm text-slate-500">
                  No equipment requests yet.{" "}
                  <Link href="/creator/equipment" className="text-orange-400 hover:text-orange-300">
                    Browse equipment →
                  </Link>
                </div>
              ) : (
                filteredRequests.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveReqId(r.id)}
                    className={`w-full border-b border-white/6 p-4 text-left transition last:border-0 ${
                      activeReqId === r.id ? "bg-orange-500/10 border-l-2 border-l-orange-500" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <p className="truncate text-sm font-medium text-white">
                      {r.equipment.category} — {r.equipment.companyName}
                    </p>
                    <p className="text-xs text-slate-400">{r.company.name || "Company"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          r.status === "PENDING"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : r.status === "APPROVED"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {r.status}
                      </span>
                      {r._count.messages > 0 && <span className="text-xs text-slate-500">{r._count.messages} msgs</span>}
                    </div>
                  </button>
                ))
              )
            ) : filteredBookings.length === 0 ? (
              <div className="storytime-empty-state m-4 p-6 text-center text-sm text-slate-500">
                No location bookings yet.{" "}
                <Link href="/creator/locations" className="text-orange-400 hover:text-orange-300">
                  Find locations →
                </Link>
              </div>
            ) : (
              filteredBookings.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setActiveBookingId(b.id)}
                  className={`w-full border-b border-white/6 p-4 text-left transition last:border-0 ${
                    activeBookingId === b.id ? "bg-orange-500/10 border-l-2 border-l-orange-500" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <p className="truncate text-sm font-medium text-white">
                    {b.location.name} — {b.location.type}
                  </p>
                  <p className="text-xs text-slate-400">{b.owner.name || "Location owner"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        b.status === "PENDING"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : b.status === "APPROVED"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {b.status}
                    </span>
                    {b._count.messages > 0 && <span className="text-xs text-slate-500">{b._count.messages} msgs</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="creator-glass-panel flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 lg:col-span-8">
          {tab === "equipment" && activeReq ? (
            <>
              <div className="shrink-0 border-b border-white/8 p-4">
                <p className="font-medium text-white">
                  {activeReq.equipment.category} — {activeReq.equipment.companyName}
                </p>
                <p className="text-xs text-slate-400">with {activeReq.company.name || "Equipment company"}</p>
              </div>
              <MessageThread
                messages={messages}
                selfId={selfId}
                bottomRef={bottomRef}
                emptyLabel="No messages yet. Say hello to coordinate your request."
              />
              <form onSubmit={sendEquipmentMessage} className="shrink-0 flex gap-3 border-t border-white/8 p-4">
                <input
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Type your message…"
                  className="storytime-input min-w-0 flex-1 px-4 py-2.5 text-sm"
                />
                <button type="submit" className="shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 text-white hover:bg-orange-600">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : tab === "locations" && activeBooking ? (
            <>
              <div className="shrink-0 border-b border-white/8 p-4">
                <p className="font-medium text-white">
                  {activeBooking.location.name} — {activeBooking.location.type}
                </p>
                <p className="text-xs text-slate-400">with {activeBooking.owner.name || "Location owner"}</p>
              </div>
              <MessageThread
                messages={messages}
                selfId={selfId}
                bottomRef={bottomRef}
                emptyLabel="No messages yet. Introduce your shoot and ask questions."
              />
              <form onSubmit={sendLocationMessage} className="shrink-0 flex gap-3 border-t border-white/8 p-4">
                <input
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Type your message…"
                  className="storytime-input min-w-0 flex-1 px-4 py-2.5 text-sm"
                />
                <button type="submit" className="shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 text-white hover:bg-orange-600">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : tab === "catering" && activeCatering ? (
            <>
              <div className="shrink-0 border-b border-white/8 p-4">
                <p className="font-medium text-white">{activeCatering.cateringCompany.companyName}</p>
                <p className="text-xs text-slate-400">Catering booking</p>
              </div>
              <MessageThread
                messages={messages}
                selfId={selfId}
                bottomRef={bottomRef}
                emptyLabel="No messages yet. Confirm menu and logistics here."
              />
              <form onSubmit={sendCateringMessage} className="shrink-0 flex gap-3 border-t border-white/8 p-4">
                <input
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Type your message…"
                  className="storytime-input min-w-0 flex-1 px-4 py-2.5 text-sm"
                />
                <button type="submit" className="shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 text-white hover:bg-orange-600">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : tab === "network" && peerId ? (
            <>
              <div className="shrink-0 border-b border-white/8 p-4">
                <p className="font-medium text-white">{peerName || "…"}</p>
                <p className="text-xs text-slate-400">Direct message</p>
              </div>
              <MessageThread
                messages={messages}
                selfId={selfId}
                bottomRef={bottomRef}
                emptyLabel="No direct messages yet. Send the first note."
              />
              <form onSubmit={sendNetworkMessage} className="shrink-0 flex gap-3 border-t border-white/8 p-4">
                <input
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Type your message…"
                  className="storytime-input min-w-0 flex-1 px-4 py-2.5 text-sm"
                />
                <button type="submit" className="shrink-0 rounded-xl bg-orange-500 px-4 py-2.5 text-white hover:bg-orange-600">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
              {tab === "network"
                ? "Select a conversation from a profile link, or go to Network to connect with creators."
                : `Select a ${tab === "equipment" ? "request" : tab === "locations" ? "booking" : "catering booking"} to view messages.`}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
