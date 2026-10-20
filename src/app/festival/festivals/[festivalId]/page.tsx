"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { OpsPageHeader, OpsSection } from "@/components/ecosystem/ops-shell";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";

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
  const [uploading, setUploading] = useState<"logo" | "header" | "gallery" | null>(null);

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
      qc.invalidateQueries({ queryKey: ["festival-list"] });
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
          acceptingSubmissions:
            action === "set_accepting_submissions" ? !data?.festival?.acceptingSubmissions : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      return json;
    },
    onSuccess: (json) => {
      setMessage(
        json.universeHoldsReleased != null
          ? `Festival ended. Released ${json.universeHoldsReleased} Universe hold(s).`
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
    mutationFn: async (url: string) => {
      const res = await fetch(`/api/festival/${festivalId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, kind: "IMAGE" }),
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

  async function uploadImage(kind: "logo" | "header" | "gallery", file: File) {
    setUploading(kind);
    setMessage("");
    try {
      const url = await uploadContentMediaViaApi(file);
      if (kind === "gallery") {
        await addMedia.mutateAsync(url);
      } else {
        const key = kind === "logo" ? "logoUrl" : "headerImageUrl";
        setForm((s) => ({ ...s, [key]: url }));
        setMessage(`${kind === "logo" ? "Logo" : "Poster"} uploaded — save setup to keep it.`);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  if (isLoading || !data?.festival) {
    return <p className="text-sm text-slate-500">Loading festival…</p>;
  }

  const f = data.festival;
  const inputClass =
    "mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-slate-950 px-3 text-sm text-white outline-none focus:border-orange-400/50";
  const areaClass =
    "mt-1.5 w-full rounded-xl border border-white/12 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/50";

  const field = (key: string, label: string, multiline = false) => (
    <label key={key} className="block text-sm text-slate-300">
      {label}
      {multiline ? (
        <textarea
          value={form[key] ?? ""}
          onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
          rows={4}
          className={areaClass}
        />
      ) : (
        <input
          value={form[key] ?? ""}
          onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
          className={inputClass}
        />
      )}
    </label>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <OpsPageHeader
        title={f.name}
        subtitle={`${f.status.replace(/_/g, " ")} · ${f.acceptingSubmissions ? "Accepting" : "Closed"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/festival/festivals"
              className="rounded-lg border border-white/12 px-3 py-2 text-sm text-slate-300"
            >
              Back
            </Link>
            {f.status === "DRAFT" || f.status === "SUBMISSIONS_CLOSED" ? (
              <button
                type="button"
                onClick={() => settings.mutate("publish")}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
              >
                Publish
              </button>
            ) : null}
            {f.status !== "ENDED" ? (
              <>
                <button
                  type="button"
                  onClick={() => settings.mutate("set_accepting_submissions")}
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200"
                >
                  {f.acceptingSubmissions ? "Close submissions" : "Reopen submissions"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("End this festival for the year?")) settings.mutate("end_festival");
                  }}
                  className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300"
                >
                  End year
                </button>
              </>
            ) : null}
          </div>
        }
      />
      {message ? <p className="text-sm text-amber-200">{message}</p> : null}

      <OpsSection title="Poster & logo">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-slate-950">
            <div className="relative aspect-[21/7] bg-slate-900">
              {form.headerImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.headerImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Festival poster / header
                </div>
              )}
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logoUrl}
                  alt=""
                  className="absolute bottom-3 left-3 h-16 w-16 rounded-xl border border-white/20 object-cover shadow-lg"
                />
              ) : null}
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border border-white/8 p-4">
            <label className="block text-sm text-slate-300">
              Upload poster
              <input
                type="file"
                accept="image/*"
                disabled={uploading !== null}
                className="mt-1.5 block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500/90 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage("header", file);
                }}
              />
            </label>
            <label className="block text-sm text-slate-300">
              Upload logo
              <input
                type="file"
                accept="image/*"
                disabled={uploading !== null}
                className="mt-1.5 block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage("logo", file);
                }}
              />
            </label>
            {uploading ? <p className="text-xs text-slate-500">Uploading {uploading}…</p> : null}
            {field("headerImageUrl", "Poster URL")}
            {field("logoUrl", "Logo URL")}
          </div>
        </div>
      </OpsSection>

      <OpsSection title="Festival details">
        <div className="cinematic-glass space-y-3 rounded-2xl border border-white/8 p-5 shadow-panel">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("name", "Name")}
            {field("tagline", "Tagline")}
            {field("yearsRunning", "Years running")}
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
            className="rounded-lg bg-orange-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950"
          >
            Save setup
          </button>
        </div>
      </OpsSection>

      <OpsSection title="Categories & fees (ZAR)">
        <div className="space-y-3 rounded-2xl border border-white/8 p-5">
          <div className="overflow-hidden rounded-xl border border-white/8">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Early</th>
                  <th className="px-3 py-2">Regular</th>
                  <th className="px-3 py-2">Late</th>
                </tr>
              </thead>
              <tbody>
                {(f.categories ?? []).map((c: {
                  id: string;
                  name: string;
                  earlybirdFeeZar: number;
                  regularFeeZar: number;
                  lateFeeZar: number;
                }) => (
                  <tr key={c.id} className="border-t border-white/8">
                    <td className="px-3 py-2 text-white">{c.name}</td>
                    <td className="px-3 py-2 text-slate-400">R{c.earlybirdFeeZar}</td>
                    <td className="px-3 py-2 text-slate-400">R{c.regularFeeZar}</td>
                    <td className="px-3 py-2 text-slate-400">R{c.lateFeeZar}</td>
                  </tr>
                ))}
                {(f.categories ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                      Add at least one category before publishing.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="Category name"
              className={inputClass}
            />
            <input value={early} onChange={(e) => setEarly(e.target.value)} placeholder="Earlybird" className={inputClass} />
            <input value={regular} onChange={(e) => setRegular(e.target.value)} placeholder="Regular" className={inputClass} />
            <input value={late} onChange={(e) => setLate(e.target.value)} placeholder="Late" className={inputClass} />
          </div>
          <button
            type="button"
            onClick={() => addCategory.mutate()}
            className="rounded-lg border border-orange-500/40 px-3 py-2 text-sm text-orange-200"
          >
            Add category
          </button>
        </div>
      </OpsSection>

      <OpsSection title="Media gallery">
        <div className="space-y-3 rounded-2xl border border-white/8 p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(f.mediaAssets ?? []).map((m: { id: string; url: string }) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={m.id} src={m.url} alt="" className="aspect-video rounded-lg object-cover" />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-white/12 px-3 py-2 text-sm text-slate-200">
              {uploading === "gallery" ? "Uploading…" : "Upload image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage("gallery", file);
                }}
              />
            </label>
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Or paste image URL"
              className={`min-w-[14rem] flex-1 ${inputClass} mt-0`}
            />
            <button
              type="button"
              onClick={() => mediaUrl && addMedia.mutate(mediaUrl)}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200"
            >
              Add URL
            </button>
          </div>
        </div>
      </OpsSection>
    </div>
  );
}
