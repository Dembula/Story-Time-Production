"use client";

import { Suspense } from "react";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Music, Search, Send, Play, Headphones, Film, MessageSquare,
  Clock, DollarSign, ChevronDown, ChevronUp, CheckCircle,
} from "lucide-react";

interface Track {
  id: string; title: string; artistName: string; audioUrl: string | null; coverUrl: string | null;
  genre: string | null; mood: string | null; bpm: number | null; key: string | null;
  duration: number | null; description: string | null; tags: string | null; language: string | null; licenseType: string;
  creator: { id: string; name: string | null; email?: string | null };
  _count: { syncDeals: number; syncRequests?: number; musicSelections?: number };
}

interface SyncRequest {
  id: string; status: string; note: string | null; projectName: string | null;
  projectType: string | null; createdAt: string;
  track: { id: string; title: string; artistName: string; coverUrl: string | null };
  musicCreator: { id: string; name: string | null; email: string | null };
  _count: { messages: number };
}

interface Msg {
  id: string; body: string; createdAt: string;
  sender: { id: string; name: string | null };
  receiver: { id: string; name: string | null };
}

function MusicContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"browse" | "requests" | "messages">(
    searchParams.get("tab") as "browse" | "requests" | "messages" || "browse"
  );
  const [tracks, setTracks] = useState<Track[]>([]);
  const [requests, setRequests] = useState<SyncRequest[]>([]);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("ALL");
  const [moodFilter, setMoodFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState<string | null>(null);
  const [form, setForm] = useState({ note: "", projectName: "", projectType: "", usageType: "", budget: "" });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/music/catalogue").then((r) => r.json()),
      fetch("/api/sync-requests").then((r) => r.json()),
    ]).then(([t, r]) => { setTracks(t); setRequests(r); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activeChat) return;
    fetch(`/api/music-messages?syncRequestId=${activeChat}`).then((r) => r.json()).then(setMessages);
  }, [activeChat]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function submitRequest(trackId: string, musicCreatorId: string) {
    setSubmitting(true);
    const res = await fetch("/api/sync-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId, ...form }),
    });
    if (res.ok) {
      const newReq = await res.json();
      setRequests((prev) => [newReq, ...prev]);
      setRequestForm(null);
      setForm({ note: "", projectName: "", projectType: "", usageType: "", budget: "" });
    }
    setSubmitting(false);
  }

  async function sendMessage() {
    if (!newMsg.trim() || !activeChat) return;
    const req = requests.find((r) => r.id === activeChat);
    if (!req) return;
    setSending(true);
    const res = await fetch("/api/music-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newMsg, receiverId: req.musicCreator.id, syncRequestId: activeChat }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, { ...msg, sender: msg.sender, receiver: { id: req.musicCreator.id, name: req.musicCreator.name } }]);
      setNewMsg("");
    }
    setSending(false);
  }

  const genres = [...new Set(tracks.map((t) => t.genre).filter(Boolean))];
  const moods = [...new Set(tracks.map((t) => t.mood).filter(Boolean))];

  const filteredTracks = tracks.filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.artistName.toLowerCase().includes(search.toLowerCase()) || t.tags?.toLowerCase().includes(search.toLowerCase());
    const matchGenre = genreFilter === "ALL" || t.genre === genreFilter;
    const matchMood = moodFilter === "ALL" || t.mood === moodFilter;
    return matchSearch && matchGenre && matchMood;
  });

  const activeChatReq = requests.find((r) => r.id === activeChat);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><Headphones className="w-8 h-8 text-pink-500" /> Music Library</h1>
        <p className="text-slate-400">Discover music for your productions. Request sync licensing and communicate directly with artists.</p>
      </div>

      <div className="flex gap-2">
        {(["browse", "requests", "messages"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${tab === t ? "bg-pink-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
            {t === "requests" ? `My Requests (${requests.length})` : t === "messages" ? "Messages" : "Browse Music"}
          </button>
        ))}
      </div>

      {tab === "browse" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, artist, or tags..." className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500" />
            </div>
            <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} className="px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm">
              <option value="ALL">All Genres</option>
              {genres.map((g) => <option key={g as string} value={g as string}>{g as string}</option>)}
            </select>
            <select value={moodFilter} onChange={(e) => setMoodFilter(e.target.value)} className="px-3 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm">
              <option value="ALL">All Moods</option>
              {moods.map((m) => <option key={m as string} value={m as string}>{m as string}</option>)}
            </select>
          </div>

          <div className="space-y-3">
            {filteredTracks.map((t) => {
              const alreadyRequested = requests.some((r) => r.track.id === t.id);
              return (
                <div key={t.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                  <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-800/70 transition" onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
                      {t.coverUrl ? <img src={t.coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Music className="w-6 h-6 text-slate-500" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{t.title}</p>
                      <p className="text-sm text-slate-400">{t.artistName} · {t.creator.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {t.genre && <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400">{t.genre}</span>}
                        {t.mood && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">{t.mood}</span>}
                        {t.bpm && <span className="text-xs text-slate-500">{t.bpm} BPM</span>}
                        {t.duration && <span className="text-xs text-slate-500">{Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, "0")}</span>}
                        {t.key && <span className="text-xs text-slate-500">{t.key}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {alreadyRequested ? (
                        <span className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Requested</span>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setRequestForm(requestForm === t.id ? null : t.id); }} className="px-3 py-1.5 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/30 text-xs font-medium hover:bg-pink-500/20 transition">Request Sync</button>
                      )}
                      {expanded === t.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>

                  {expanded === t.id && (
                    <div className="border-t border-slate-700/50 p-4 bg-slate-900/20 space-y-3">
                      {t.description && <p className="text-sm text-slate-400">{t.description}</p>}
                      <div className="flex flex-wrap gap-3 text-xs">
                        {t.language && <span className="text-slate-500">Language: {t.language}</span>}
                        <span className="text-slate-500">License: {t.licenseType.replace(/_/g, " ")}</span>
                        <span className="text-slate-500">{t._count.syncDeals} existing placements</span>
                      </div>
                      {t.tags && <div className="flex flex-wrap gap-1">{t.tags.split(",").map((tag) => <span key={tag.trim()} className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-400">{tag.trim()}</span>)}</div>}
                      {t.audioUrl && <audio src={t.audioUrl} controls className="w-full mt-2" />}
                    </div>
                  )}

                  {requestForm === t.id && (
                    <div className="border-t border-pink-500/20 p-5 bg-pink-500/5 space-y-3">
                      <h4 className="text-white font-medium text-sm">Request Sync License for &quot;{t.title}&quot;</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div><label className="block text-xs text-slate-400 mb-1">Project Name</label><input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Your film/series name" /></div>
                        <div><label className="block text-xs text-slate-400 mb-1">Project Type</label><select value={form.projectType} onChange={(e) => setForm({ ...form, projectType: e.target.value })} className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm"><option value="">Select...</option><option value="Film">Film</option><option value="Series">Series</option><option value="Documentary">Documentary</option><option value="Short Film">Short Film</option><option value="Music Video">Music Video</option><option value="Other">Other</option></select></div>
                        <div><label className="block text-xs text-slate-400 mb-1">Usage</label><input value={form.usageType} onChange={(e) => setForm({ ...form, usageType: e.target.value })} className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="e.g. Opening Scene, End Credits" /></div>
                        <div><label className="block text-xs text-slate-400 mb-1">Budget ($)</label><input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Proposed amount" /></div>
                      </div>
                      <div><label className="block text-xs text-slate-400 mb-1">Message to Artist</label><textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" placeholder="Tell them about your project and why their music is perfect..." /></div>
                      <div className="flex gap-2">
                        <button onClick={() => submitRequest(t.id, t.creator.id)} disabled={submitting} className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600 transition disabled:opacity-50">{submitting ? "Sending..." : "Send Request"}</button>
                        <button onClick={() => setRequestForm(null)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "requests" && (
        <div className="space-y-3">
          {requests.length === 0 && <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center"><Music className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No sync requests sent yet. Browse music to find tracks for your productions.</p></div>}
          {requests.map((r) => (
            <div key={r.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <div className="flex items-center gap-4">
                {r.track.coverUrl && <img src={r.track.coverUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium">{r.track.title}</p>
                    <span className="text-xs text-slate-500">by {r.track.artistName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" : r.status === "APPROVED" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{r.status}</span>
                  </div>
                  <p className="text-xs text-slate-500">{r.projectName || "No project"} · {new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={() => { setTab("messages"); setActiveChat(r.id); }} className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 transition flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Chat</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "messages" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: "50vh" }}>
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700/50"><h3 className="text-white font-medium text-sm">Conversations</h3></div>
            <div className="divide-y divide-slate-700/30 max-h-[50vh] overflow-y-auto">
              {requests.map((r) => (
                <button key={r.id} onClick={() => setActiveChat(r.id)} className={`w-full text-left p-4 hover:bg-slate-800/40 transition ${activeChat === r.id ? "bg-slate-800/50 border-l-2 border-l-pink-500" : ""}`}>
                  <p className="text-white text-sm font-medium truncate">{r.musicCreator.name || "Artist"}</p>
                  <p className="text-xs text-slate-500 truncate"><Music className="w-3 h-3 inline" /> {r.track.title}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 bg-slate-800/30 border border-slate-700/50 rounded-xl flex flex-col overflow-hidden">
            {activeChatReq ? (
              <>
                <div className="p-4 border-b border-slate-700/50">
                  <p className="text-white font-medium text-sm">{activeChatReq.musicCreator.name}</p>
                  <p className="text-xs text-slate-500">{activeChatReq.track.title}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  {messages.map((m) => {
                    const isMine = m.sender.id !== activeChatReq.musicCreator.id;
                    return (
                      <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] p-3 rounded-xl ${isMine ? "bg-orange-500/20 text-orange-100" : "bg-slate-700/50 text-slate-300"}`}>
                          <p className="text-sm">{m.body}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEnd} />
                </div>
                <div className="p-4 border-t border-slate-700/50">
                  <div className="flex gap-2">
                    <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Type a message..." className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500" />
                    <button onClick={sendMessage} disabled={sending || !newMsg.trim()} className="px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50"><Send className="w-4 h-4" /></button>
                  </div>
                </div>
              </>
            ) : <div className="flex-1 flex items-center justify-center"><p className="text-slate-500 text-sm">Select a conversation</p></div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreatorMusicPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}><MusicContent /></Suspense>;
}
