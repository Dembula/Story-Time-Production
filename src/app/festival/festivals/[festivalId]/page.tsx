"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export default function FestivalSetupPage() {
  const params = useParams();
  const festivalId = String(params.festivalId);
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [catName, setCatName] = useState("");
  const [early, setEarly] = useState("150");
  const [regular, setRegular] = useState("250");
  const [late, setLate] = useState("350");
  const [mediaUrl, setMediaUrl] = useState("");
  const [message, setMessage] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["festival", festivalId],
    queryFn: () => fetch(`/api/festival/${festivalId}`).then((r) => r.json()),
  });

  useEffect(() => {
    const f = data?.festival;
    if (!f) return;
    setForm({
      name: f.name ?? "",
      tagline: f.tagline ?? "",
      about: f.about ?? "",
      awardsText: f.awardsText ?? "",
      rulesText: f.rulesText ?? "",
      organizers: f.organizers ?? "",
      logoUrl: f.logoUrl ?? "",
      headerImageUrl: f.headerImageUrl ?? "",
      contactEmail: f.contactEmail ?? "",
      contactPhone: f.contactPhone ?? "",
      websiteUrl: f.websiteUrl ?? "",
      facebookUrl: f.facebookUrl ?? "",
      twitterUrl: f.twitterUrl ?? "",
      instagramUrl: f.instagramUrl ?? "",
      yearsRunning: String(f.yearsRunning ?? 1),
      openingAt: f.openingAt ? f.openingAt.slice(0, 10) : "",
      earlybirdAt: f.earlybirdAt ? f.earlybirdAt.slice(0, 10) : "",
      regularAt: f.regularAt ? f.regularAt.slice(0, 10) : "",
      lateAt: f.lateAt ? f.lateAt.slice(0, 10) : "",
      notificationAt: f.notificationAt ? f.notificationAt.slice(0, 10) : "",
      eventStartsAt: f.eventStartsAt ? f.eventStartsAt.slice(0, 10) : "",
      eventEndsAt: f.eventEndsAt ? f.eventEndsAt.slice(0, 10) : "",
    });
  }, [data?.festival]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/festival/${festivalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          yearsRunning: Number(form.yearsRunning) || 1,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      return json;
    },
    onSuccess: () => {
      setMessage("Saved.");
      qc.invalidateQueries({ queryKey: ["festival", festivalId] });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const settings = useMutation({
    mutationFn: async (action: string) => {
      const res = await fetch(`/api/festival/${festivalId}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          acceptingSubmissions: action === "set_accepting_submissions" ? !data?.festival?.acceptingSubmissions : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      return json;
    },
    onSuccess: (json) => {
      setMessage(
        json.universeHoldsReleased != null
          ? `Festival ended. Released ${json.universeHoldsReleased} Universe hold(s) to admin review.`
          : "Updated.",
      );
      qc.invalidateQueries({ queryKey: ["festival", festivalId] });
      qc.invalidateQueries({ queryKey: ["festival-list"] });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/festival/${festivalId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catName,
          earlybirdFeeZar: Number(early),
          regularFeeZar: Number(regular),
          lateFeeZar: Number(late),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: () => {
      setCatName("");
      qc.invalidateQueries({ queryKey: ["festival", festivalId] });
    },
  });

  const addMedia = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/festival/${festivalId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: mediaUrl, kind: "IMAGE" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      return json;
    },
    onSuccess: () => {
      setMediaUrl("");
      qc.invalidateQueries({ queryKey: ["festival", festivalId] });
    },
  });

  if (isLoading || !data?.festival) {
    return <p className="text-sm text-slate-500">Loading festival…</p>;
  }

  const f = data.festival;
  const field = (key: string, label: string, multiline = false) => (
    <label key={key} className="block text-sm text-slate-300">
      {label}
      {multiline ? (
        <textarea
          value={form[key] ?? ""}
          onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
          rows={4}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
        />
      ) : (
        <input
          value={form[key] ?? ""}
          onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
        />
      )}
    </label>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white">{f.name}</h1>
          <p className="text-sm text-slate-400">
            Status: {f.status} · {f.acceptingSubmissions ? "Accepting submissions" : "Closed"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {f.status === "DRAFT" || f.status === "SUBMISSIONS_CLOSED" ? (
            <button
              type="button"
              onClick={() => settings.mutate("publish")}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Publish / open
            </button>
          ) : null}
          {f.status !== "ENDED" ? (
            <>
              <button
                type="button"
                onClick={() => settings.mutate("set_accepting_submissions")}
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
              >
                {f.acceptingSubmissions ? "Close submissions" : "Reopen submissions"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("End this festival for the year? Universe opt-ins will unlock for Story Time admin review.")) {
                    settings.mutate("end_festival");
                  }
                }}
                className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300"
              >
                End festival for this year
              </button>
            </>
          ) : null}
        </div>
      </div>
      {message ? <p className="text-sm text-amber-200">{message}</p> : null}

      <section className="space-y-3 rounded-2xl border border-slate-800 p-5">
        <h2 className="text-lg font-semibold text-white">Festival setup</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("name", "Name")}
          {field("tagline", "Tagline")}
          {field("yearsRunning", "Years running")}
          {field("logoUrl", "Logo URL")}
          {field("headerImageUrl", "Header image URL")}
          {field("organizers", "Organizers")}
        </div>
        {field("about", "About", true)}
        {field("awardsText", "Awards & prizes", true)}
        {field("rulesText", "Rules & terms", true)}
        <div className="grid gap-3 sm:grid-cols-2">
          {field("contactEmail", "Contact email")}
          {field("contactPhone", "Phone")}
          {field("websiteUrl", "Website")}
          {field("facebookUrl", "Facebook")}
          {field("twitterUrl", "X / Twitter")}
          {field("instagramUrl", "Instagram")}
          {field("openingAt", "Opening date")}
          {field("earlybirdAt", "Earlybird deadline")}
          {field("regularAt", "Regular deadline")}
          {field("lateAt", "Late deadline")}
          {field("notificationAt", "Notification date")}
          {field("eventStartsAt", "Event start")}
          {field("eventEndsAt", "Event end")}
        </div>
        <button
          type="button"
          onClick={() => save.mutate()}
          className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Save setup
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-800 p-5">
        <h2 className="text-lg font-semibold text-white">Categories & fees (ZAR)</h2>
        <ul className="space-y-2 text-sm text-slate-300">
          {(f.categories ?? []).map((c: { id: string; name: string; earlybirdFeeZar: number; regularFeeZar: number; lateFeeZar: number }) => (
            <li key={c.id} className="rounded-lg border border-slate-800 px-3 py-2">
              <span className="font-medium text-white">{c.name}</span>
              <span className="ml-2 text-slate-500">
                Early R{c.earlybirdFeeZar} · Regular R{c.regularFeeZar} · Late R{c.lateFeeZar}
              </span>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Category name" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white sm:col-span-1" />
          <input value={early} onChange={(e) => setEarly(e.target.value)} placeholder="Earlybird" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          <input value={regular} onChange={(e) => setRegular(e.target.value)} placeholder="Regular" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
          <input value={late} onChange={(e) => setLate(e.target.value)} placeholder="Late" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
        </div>
        <button type="button" onClick={() => addCategory.mutate()} className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-200">
          Add category
        </button>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-800 p-5">
        <h2 className="text-lg font-semibold text-white">Media catalogue</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(f.mediaAssets ?? []).map((m: { id: string; url: string }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.id} src={m.url} alt="" className="aspect-video rounded-lg object-cover" />
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="Image URL from previous events"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <button type="button" onClick={() => addMedia.mutate()} className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200">
            Add
          </button>
        </div>
      </section>
    </div>
  );
}
