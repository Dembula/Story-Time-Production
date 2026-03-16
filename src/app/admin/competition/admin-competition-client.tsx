"use client";

import { useEffect, useState } from "react";
import { Trophy, RefreshCw, Crown, Zap } from "lucide-react";

type Period = { id: string; name: string; status: string; winnerId: string | null };
type LeaderEntry = { rank: number; creatorId: string; creatorName: string; creatorEmail: string | null; voteCount: number };
type VoteEntry = { id: string; voter: { name: string | null; email: string | null }; creator: { name: string | null }; createdAt: string };

export function AdminCompetitionClient() {
  const [period, setPeriod] = useState<Period | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [votes, setVotes] = useState<VoteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [goLiveName, setGoLiveName] = useState("Viewer Choice");
  const [goLiveDays, setGoLiveDays] = useState(7);
  const [goLiveLoading, setGoLiveLoading] = useState(false);
  const [goLiveMessage, setGoLiveMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function refresh() {
    fetch("/api/competition/leaderboard").then((r) => r.json()).then((d) => {
      setPeriod(d.period);
      setLeaderboard(d.leaderboard || []);
      setVotes(d.votes || []);
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  async function setWinner(creatorId: string) {
    const res = await fetch("/api/competition/set-winner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId }),
    });
    if (res.ok) refresh();
  }

  async function makeLive() {
    setGoLiveMessage(null);
    setGoLiveLoading(true);
    try {
      const res = await fetch("/api/admin/competition/go-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: goLiveName, durationDays: goLiveDays }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setGoLiveMessage({ type: "ok", text: `Competition is live. Notifications sent to ${data.notificationsSent ?? 0} accounts.` });
        refresh();
      } else {
        setGoLiveMessage({ type: "err", text: data.error ?? "Failed to go live" });
      }
    } catch {
      setGoLiveMessage({ type: "err", text: "Request failed" });
    } finally {
      setGoLiveLoading(false);
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><Trophy className="w-8 h-8 text-amber-500" /> Viewer Choice Competition</h1>
        <p className="text-slate-400">Viewers connect directly with creators and help them get great opportunities. The winner receives a Story Time Original. Make the competition live to notify all accounts; they can then vote at /browse/competition.</p>
      </div>

      <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> Make competition live</h2>
        <p className="text-slate-400 text-sm mb-4">This will close any current open period, create a new one, and send a notification to every account that the competition is live for the chosen duration. The winner can be set from the leaderboard below.</p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Competition name</label>
            <input
              value={goLiveName}
              onChange={(e) => setGoLiveName(e.target.value)}
              className="w-56 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
              placeholder="Viewer Choice"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Duration (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={goLiveDays}
              onChange={(e) => setGoLiveDays(Number(e.target.value) || 7)}
              className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            onClick={makeLive}
            disabled={goLiveLoading}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {goLiveLoading ? "Sending…" : "Make live & notify everyone"}
          </button>
        </div>
        {goLiveMessage && (
          <p className={`mt-3 text-sm ${goLiveMessage.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
            {goLiveMessage.text}
          </p>
        )}
      </div>

      {!period ? (
        <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-12 text-center text-slate-500">No competition period yet. Use &quot;Make live & notify everyone&quot; above to start one.</div>
      ) : (
        <>
          <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-5 flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{period.name}</p>
              <p className="text-sm text-slate-400">Status: {period.status} {period.winnerId ? "· Winner set" : ""}</p>
            </div>
            <button onClick={refresh} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm"><RefreshCw className="w-4 h-4" /> Refresh</button>
          </div>

          <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
            <h2 className="p-4 border-b border-slate-700/50 text-white font-semibold">Top 100</h2>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Rank</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Creator</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Votes</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((e) => (
                    <tr key={e.creatorId} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                      <td className="py-3 px-4 text-white font-medium">#{e.rank}</td>
                      <td className="py-3 px-4 text-white">{e.creatorName} {e.creatorEmail ? <span className="text-slate-500 text-xs">({e.creatorEmail})</span> : null}</td>
                      <td className="py-3 px-4 text-amber-400">{e.voteCount}</td>
                      <td className="py-3 px-4">
                        {period.winnerId === e.creatorId ? <span className="text-emerald-400 flex items-center gap-1"><Crown className="w-4 h-4" /> Winner</span> : period.status === "OPEN" ? (
                          <button onClick={() => setWinner(e.creatorId)} className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 text-xs">Set winner</button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
            <h2 className="p-4 border-b border-slate-700/50 text-white font-semibold">Recent votes</h2>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-700"><th className="text-left py-2 px-4 text-slate-400 font-medium">Voter</th><th className="text-left py-2 px-4 text-slate-400 font-medium">Voted for</th><th className="text-left py-2 px-4 text-slate-400 font-medium">Time</th></tr></thead>
                <tbody>
                  {votes.map((v) => (
                    <tr key={v.id} className="border-b border-slate-700/30"><td className="py-2 px-4 text-slate-300">{v.voter.name || v.voter.email}</td><td className="py-2 px-4 text-slate-400">{v.creator.name}</td><td className="py-2 px-4 text-slate-500">{new Date(v.createdAt).toLocaleString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
