"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, User, Shield, Users, CheckCircle, AlertCircle } from "lucide-react";

type Profile = { id: string; name: string; age: number; updatedAt: string | Date };

function ageLabel(age: number): string {
  if (age <= 12) return "Kids";
  if (age <= 15) return "Teen";
  return "Adult";
}

export function ProfilesClient({ initialProfiles }: { initialProfiles: Profile[] }) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles ?? []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState<number>(18);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const maxProfiles = useMemo(() => 5, []);

  async function setActive(profileId: string) {
    setError("");
    setLoading(profileId);
    try {
      const res = await fetch("/api/viewer/profiles/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to select profile");
      }
      router.push("/browse");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to select profile");
    } finally {
      setLoading(null);
    }
  }

  async function createProfile() {
    setError("");
    if (!name.trim()) {
      setError("Please enter a profile name.");
      return;
    }
    if (profiles.length >= maxProfiles) {
      setError("You’ve reached the maximum number of profiles for this account.");
      return;
    }

    setLoading("create");
    try {
      const res = await fetch("/api/viewer/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), age }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create profile");
      setProfiles((prev) => [...prev, data.profile]);
      setCreating(false);
      setName("");
      setAge(18);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create profile");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-semibold text-white">Who’s watching?</h1>
        <p className="text-slate-400 max-w-2xl">
          Create a profile for each household member. Each profile gets its own watch history,
          recommendations, and age-based censorship.
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-2">
              <Users className="w-4 h-4" /> Profiles
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              {profiles.length} / {maxProfiles}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Censorship
            </p>
            <p className="text-sm text-slate-300 mt-1">
              Titles are hidden if the profile’s age is below the content’s minimum age.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Personalization
            </p>
            <p className="text-sm text-slate-300 mt-1">
              Recommendations are built per profile from viewing behavior and preferences.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {profiles.length === 0 && !creating && (
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-6 mb-6">
          <p className="text-orange-200 font-medium">Create your first profile to start watching.</p>
          <p className="text-slate-400 text-sm mt-1">Each profile has its own watch history, recommendations, and age-appropriate catalogue.</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 px-5 py-2.5 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition"
          >
            Create profile
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p.id)}
            disabled={loading !== null}
            className="group text-left rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900/80 transition p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {ageLabel(p.age)} · Age {p.age}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Personalized feed + censorship based on this profile.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                {loading === p.id ? "Loading…" : "Select"}
              </div>
            </div>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={profiles.length >= maxProfiles || loading !== null}
          className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 hover:bg-slate-900/60 transition p-5 text-left disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Plus className="w-5 h-5 text-slate-300" />
            </div>
            <div>
              <p className="text-white font-semibold">Add profile</p>
              <p className="text-xs text-slate-500">
                Create a separate sub-account for a household member.
              </p>
            </div>
          </div>
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Create a profile</h2>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Profile name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Adults, Mom, Sipho"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Age (for censorship)</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(Math.max(0, Math.min(120, Number(e.target.value || 0))))}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
              <p className="text-[11px] text-slate-500">
                Titles with a minimum age above this value will be hidden and blocked.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800/60 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={createProfile}
              disabled={loading !== null}
              className="px-5 py-2.5 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50 transition"
            >
              {loading === "create" ? "Creating…" : "Create profile"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

