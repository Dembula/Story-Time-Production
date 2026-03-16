"use client";

import { useEffect, useState } from "react";
import { Trophy, Vote, RefreshCw } from "lucide-react";

type Period = { id: string; name: string; endDate: string; winner: { id: string; name: string | null } | null } | null;
type Creator = { id: string; name: string | null };
type LeaderboardEntry = { creatorId: string; creatorName: string; voteCount: number };

export function CompetitionClient({
  initialPeriod,
  creators,
  isLoggedIn,
}: {
  initialPeriod: Period;
  creators: Creator[];
  isLoggedIn: boolean;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myVote, setMyVote] = useState<{ creatorId: string; creatorName: string } | null>(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function refresh() {
    fetch("/api/competition/current").then((r) => r.json()).then((d) => {
      setPeriod(d.period);
      setLeaderboard(d.leaderboard || []);
    });
    if (isLoggedIn) fetch("/api/competition/my-vote").then((r) => r.json()).then((d) => setMyVote(d.vote));
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [isLoggedIn]);

  async function vote() {
    if (!selectedCreatorId || !isLoggedIn) return;
    setLoading(true);
    try {
      const res = await fetch("/api/competition/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: selectedCreatorId }),
      });
      if (res.ok) refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!period) {
    return (
      <div className="text-center py-16">
        <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Viewer Choice Competition</h1>
        <p className="text-slate-400 max-w-lg mx-auto">
          Vote for your favourite creator and help them get a Story Time Original. When a competition is live, you’ll get a notification — no active competition at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Trophy className="w-8 h-8 text-orange-500" /> Viewer Choice</h1>
        <p className="text-slate-400 mt-1">{period.name} · Ends {new Date(period.endDate).toLocaleDateString()}</p>
        <p className="text-slate-300 mt-2 text-sm max-w-xl">
          Connect directly with creators: your vote helps them get great opportunities. The winner receives a <strong className="text-orange-400">Story Time Original</strong>.
        </p>
        {period.winner && <p className="text-orange-400 font-medium mt-2">Winner: {period.winner.name} — Story Time Original</p>}
      </div>

      <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><RefreshCw className="w-5 h-5 text-slate-400" /> Top 5</h2>
        <ul className="space-y-3">
          {leaderboard.map((e, i) => (
            <li key={e.creatorId} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
              <span className="text-white font-medium">#{i + 1} {e.creatorName}</span>
              <span className="text-orange-400">{e.voteCount} votes</span>
            </li>
          ))}
        </ul>
        {leaderboard.length === 0 && <p className="text-slate-500 text-sm">No votes yet. Be the first to vote!</p>}
      </div>

      {isLoggedIn && !period.winner && (
        <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Vote className="w-5 h-5 text-orange-400" /> Vote for your favourite creator</h2>
          {myVote ? (
            <p className="text-slate-400">You voted for <span className="text-orange-400 font-medium">{myVote.creatorName}</span>. You can change your vote below.</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {creators.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCreatorId(c.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedCreatorId === c.id ? "bg-orange-500 text-white" : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"}`}
              >
                {c.name || "Unknown"}
              </button>
            ))}
          </div>
          <button onClick={vote} disabled={!selectedCreatorId || loading} className="mt-4 px-6 py-2.5 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50">
            {loading ? "Submitting…" : "Submit vote"}
          </button>
        </div>
      )}

      {!isLoggedIn && (
        <p className="text-slate-400 text-sm">Sign in to vote for your favourite creator.</p>
      )}
    </div>
  );
}
