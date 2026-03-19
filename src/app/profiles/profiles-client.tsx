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
        <h1 className="font-display text-3xl font-semibold text-white md:text-4xl">Who’s watching?</h1>
        <p className="max-w-2xl text-slate-300/78">
          Create a profile for each household member. Each profile gets its own watch history,
          recommendations, and age-based censorship.
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="storytime-kpi p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-2">
              <Users className="w-4 h-4" /> Profiles
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              {profiles.length} / {maxProfiles}
            </p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Censorship
            </p>
            <p className="text-sm text-slate-300 mt-1">
              Titles are hidden if the profile’s age is below the content’s minimum age.
            </p>
          </div>
          <div className="storytime-kpi p-4">
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
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 shadow-panel">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {profiles.length === 0 && !creating && (
        <div className="mb-6 rounded-2xl border border-orange-400/20 bg-orange-500/6 p-6 shadow-panel">
          <p className="text-orange-200 font-medium">Create your first profile to start watching.</p>
          <p className="text-slate-400 text-sm mt-1">Each profile has its own watch history, recommendations, and age-appropriate catalogue.</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400"
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
            className="storytime-section group p-5 text-left hover:-translate-y-1 hover:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-500/10">
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
          className="storytime-empty-state p-5 text-left disabled:opacity-50 hover:bg-white/[0.04]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04]">
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
        <div className="storytime-section space-y-4 p-6">
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
                className="storytime-input px-3 py-2.5"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Age (for censorship)</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(Math.max(0, Math.min(120, Number(e.target.value || 0))))}
                className="storytime-input px-3 py-2.5"
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
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-slate-200 hover:bg-white/[0.05]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={createProfile}
              disabled={loading !== null}
              className="rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50"
            >
              {loading === "create" ? "Creating…" : "Create profile"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

