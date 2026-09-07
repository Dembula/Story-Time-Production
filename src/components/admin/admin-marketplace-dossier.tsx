"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Calendar, Package, Users } from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";

export type MarketplaceDossierType = "crew" | "cast" | "locations" | "equipment" | "catering";

type TabId = "overview" | "roster" | "requests" | "contracts" | "activity";

type DossierShell = {
  type: MarketplaceDossierType;
  id: string;
  companyName: string;
  tagline?: string | null;
  description?: string | null;
  website?: string | null;
  specializations?: string | null;
  location?: string | null;
  logoUrl?: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    professionalName?: string | null;
    createdAt?: string;
  } | null;
  subscription?: {
    id: string;
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
  } | null;
  counts: Record<string, number>;
  activity: Array<{ at: string; kind: string; label: string; status?: string | null }>;
  roster?: Array<Record<string, unknown>>;
  talent?: Array<Record<string, unknown>>;
  listings?: Array<Record<string, unknown>>;
  requests?: Array<Record<string, unknown>>;
  inquiries?: Array<Record<string, unknown>>;
  invitations?: Array<Record<string, unknown>>;
  bookings?: Array<Record<string, unknown>>;
  contracts?: Array<Record<string, unknown>>;
  auditionSubmissions?: Array<Record<string, unknown>>;
  inventoryTags?: Array<Record<string, unknown>>;
  mealForecasts?: Array<Record<string, unknown>>;
};

const BACK_HREF: Record<MarketplaceDossierType, string> = {
  crew: "/admin/crew",
  cast: "/admin/cast",
  locations: "/admin/locations",
  equipment: "/admin/marketplace-vendors",
  catering: "/admin/marketplace-vendors",
};

const TYPE_LABEL: Record<MarketplaceDossierType, string> = {
  crew: "Crew team",
  cast: "Casting agency",
  locations: "Location owner",
  equipment: "Equipment company",
  catering: "Catering company",
};

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function StatusPill({ status }: { status?: string | null }) {
  if (!status) return null;
  const tone =
    status === "PENDING" || status === "SUBMITTED"
      ? "bg-yellow-500/10 text-yellow-400"
      : status === "APPROVED" || status === "ACCEPTED" || status === "ACTIVE" || status === "CONFIRMED"
        ? "bg-emerald-500/10 text-emerald-400"
        : status === "DECLINED" || status === "REJECTED" || status === "CANCELLED"
          ? "bg-red-500/10 text-red-400"
          : "bg-slate-500/10 text-slate-300";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>{status}</span>;
}

export function AdminMarketplaceDossier({
  type,
  id,
}: {
  type: MarketplaceDossierType;
  id: string;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-marketplace-dossier", type, id],
    queryFn: async () => {
      const r = await fetch(`/api/admin/marketplace/${type}/${id}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Failed to load dossier");
      return json as DossierShell;
    },
  });

  const tabs = useMemo(() => {
    const rosterLabel =
      type === "crew" ? "Roster" : type === "cast" ? "Talent" : type === "locations" || type === "equipment" ? "Inventory" : "Menu & forecasts";
    const requestsLabel =
      type === "cast" ? "Inquiries" : type === "locations" || type === "catering" ? "Bookings" : "Requests";
    return [
      { id: "overview" as const, label: "Overview" },
      { id: "roster" as const, label: rosterLabel },
      { id: "requests" as const, label: requestsLabel },
      ...(type === "crew" ? [{ id: "contracts" as const, label: "Contracts" }] : []),
      { id: "activity" as const, label: "Activity" },
    ];
  }, [type]);

  if (isLoading) return <StoryTimeLoadingCenter />;
  if (error || !data) {
    return (
      <div className="p-8 text-center text-red-400">
        {(error as Error)?.message || "Not found"}
        <div className="mt-4">
          <Link href={BACK_HREF[type]} className="text-sm text-slate-400 underline">
            Back to list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={BACK_HREF[type]}
            className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <p className="text-xs uppercase tracking-wide text-slate-500">{TYPE_LABEL[type]}</p>
          <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl">{data.companyName}</h1>
          {data.tagline && <p className="mt-1 text-sm text-slate-400">{data.tagline}</p>}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {data.location && <span>{data.location}</span>}
            {data.user && (
              <span>
                Owner: {data.user.name || data.user.email}
                {data.user.email && data.user.name ? ` · ${data.user.email}` : ""}
              </span>
            )}
            {data.website && (
              <a href={data.website} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                Website
              </a>
            )}
          </div>
        </div>
        {data.subscription && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3 text-sm">
            <p className="text-xs text-slate-500">Subscription</p>
            <p className="font-medium text-white">{data.subscription.plan}</p>
            <StatusPill status={data.subscription.status} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(data.counts).map(([key, value]) => (
          <div key={key} className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{key}</p>
            <p className="text-xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.id ? "bg-orange-500 text-white" : "border border-slate-700/50 bg-slate-800/40 text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <section className="space-y-4 rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Building2 className="h-5 w-5 text-orange-400" /> Profile
          </h2>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">
            {data.description || "No description provided."}
          </p>
          {data.specializations && (
            <p className="text-xs text-slate-500">
              Specializations: <span className="text-slate-300">{data.specializations}</span>
            </p>
          )}
          <div className="pt-2">
            <h3 className="mb-2 text-sm font-medium text-white">Recent activity</h3>
            <ActivityList items={data.activity.slice(0, 8)} />
          </div>
        </section>
      )}

      {tab === "roster" && (
        <section className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <Users className="h-5 w-5 text-orange-400" />{" "}
            {type === "crew" ? "Roster" : type === "cast" ? "Talent" : "Listings / inventory"}
          </h2>
          {type === "crew" && <PeopleRows rows={(data.roster || []) as Array<{ id: string; name: string; role?: string; department?: string | null; dailyRate?: number | null }>} kind="crew" />}
          {type === "cast" && <PeopleRows rows={(data.talent || []) as Array<{ id: string; name: string; ageRange?: string | null; skills?: string | null; dailyRate?: number | null }>} kind="cast" />}
          {(type === "locations" || type === "equipment") && (
            <ListingRows type={type} rows={(data.listings || []) as Array<Record<string, unknown>>} />
          )}
          {type === "catering" && (
            <ForecastRows rows={(data.mealForecasts || []) as Array<Record<string, unknown>>} />
          )}
          {type === "equipment" && (data.inventoryTags?.length ?? 0) > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-medium text-white">RFID tags</h3>
              <ul className="space-y-1 text-sm text-slate-400">
                {(data.inventoryTags || []).map((t) => (
                  <li key={String(t.id)} className="flex justify-between gap-2 border-b border-slate-800/60 py-1.5">
                    <span>{String(t.rfidTag)}</span>
                    <StatusPill status={String(t.status || "")} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {tab === "requests" && (
        <section className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <Package className="h-5 w-5 text-orange-400" /> Requests & bookings
          </h2>
          <RequestRows type={type} data={data} />
        </section>
      )}

      {tab === "contracts" && type === "crew" && (
        <section className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">Projects / contracts</h2>
          {(data.contracts || []).length === 0 ? (
            <p className="text-sm text-slate-500">No contracts yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(data.contracts || []).map((c) => {
                const project = c.project as { title?: string } | undefined;
                return (
                  <li key={String(c.id)} className="flex items-center justify-between gap-2 border-b border-slate-800/60 py-2">
                    <span className="text-slate-200">{project?.title || "Project"} · {String(c.type || "")}</span>
                    <StatusPill status={String(c.status || "")} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === "activity" && (
        <section className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <Calendar className="h-5 w-5 text-orange-400" /> Activity timeline
          </h2>
          <ActivityList items={data.activity} />
        </section>
      )}
    </div>
  );
}

function ActivityList({ items }: { items: DossierShell["activity"] }) {
  if (!items.length) return <p className="text-sm text-slate-500">No recent activity.</p>;
  return (
    <ul className="space-y-2">
      {items.map((a, i) => (
        <li key={`${a.at}-${i}`} className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/50 py-2 text-sm">
          <div>
            <p className="text-slate-200">{a.label}</p>
            <p className="text-[11px] text-slate-500">
              {a.kind} · {fmtDate(a.at)}
            </p>
          </div>
          <StatusPill status={a.status} />
        </li>
      ))}
    </ul>
  );
}

function PeopleRows({
  rows,
  kind,
}: {
  rows: Array<{ id: string; name: string; role?: string; department?: string | null; ageRange?: string | null; skills?: string | null; dailyRate?: number | null }>;
  kind: "crew" | "cast";
}) {
  if (!rows.length) return <p className="text-sm text-slate-500">None listed.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex justify-between gap-3 border-b border-slate-800/60 py-2">
          <div>
            <p className="text-white">{r.name}</p>
            <p className="text-xs text-slate-500">
              {kind === "crew"
                ? [r.role, r.department].filter(Boolean).join(" · ")
                : [r.ageRange, r.skills].filter(Boolean).join(" · ")}
            </p>
          </div>
          {r.dailyRate != null && <span className="text-xs text-slate-400">R{r.dailyRate}/day</span>}
        </li>
      ))}
    </ul>
  );
}

function ListingRows({ type, rows }: { type: "locations" | "equipment"; rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return <p className="text-sm text-slate-500">No listings.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((row) => {
        const id = String(row.id);
        const title = type === "locations" ? String(row.name || "Listing") : String(row.companyName || row.category || "Listing");
        const meta =
          type === "locations"
            ? [row.type, row.city, row.dailyRate != null ? `R${row.dailyRate}/day` : null].filter(Boolean).join(" · ")
            : [row.category, row.dailyRate != null ? `R${row.dailyRate}/day` : null].filter(Boolean).join(" · ");
        const count = (row._count as { bookings?: number; requests?: number } | undefined) || {};
        return (
          <li key={id} className="flex justify-between gap-3 border-b border-slate-800/60 py-2">
            <div>
              <p className="text-white">{title}</p>
              <p className="text-xs text-slate-500">{meta}</p>
            </div>
            <span className="text-xs text-slate-500">
              {type === "locations" ? `${count.bookings ?? 0} bookings` : `${count.requests ?? 0} requests`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ForecastRows({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return <p className="text-sm text-slate-500">No meal forecasts.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((f) => (
        <li key={String(f.id)} className="flex justify-between gap-3 border-b border-slate-800/60 py-2">
          <div>
            <p className="text-white">{String(f.eventDate)} · {String(f.headCount)} pax</p>
            <p className="text-xs text-slate-500">
              B{String(f.breakfastCount)} / L{String(f.lunchCount)} / D{String(f.dinnerCount)}
            </p>
          </div>
          <StatusPill status={String(f.status || "")} />
        </li>
      ))}
    </ul>
  );
}

function RequestRows({ type, data }: { type: MarketplaceDossierType; data: DossierShell }) {
  if (type === "crew") {
    const rows = data.requests || [];
    if (!rows.length) return <p className="text-sm text-slate-500">No requests.</p>;
    return (
      <ul className="space-y-2 text-sm">
        {rows.map((r) => {
          const creator = r.creator as { name?: string | null; email?: string | null } | undefined;
          return (
            <li key={String(r.id)} className="flex justify-between gap-2 border-b border-slate-800/60 py-2">
              <div>
                <p className="text-slate-200">{creator?.name || creator?.email || "Creator"}</p>
                <p className="text-xs text-slate-500">{fmtDate(String(r.createdAt || ""))}</p>
              </div>
              <StatusPill status={String(r.status || "")} />
            </li>
          );
        })}
      </ul>
    );
  }
  if (type === "cast") {
    const rows = data.inquiries || [];
    return (
      <div className="space-y-6">
        <div>
          <h3 className="mb-2 text-sm font-medium text-white">Inquiries</h3>
          {!rows.length ? (
            <p className="text-sm text-slate-500">None</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.map((r) => {
                const creator = r.creator as { name?: string | null; email?: string | null } | undefined;
                return (
                  <li key={String(r.id)} className="flex justify-between gap-2 border-b border-slate-800/60 py-2">
                    <div>
                      <p className="text-slate-200">
                        {creator?.name || creator?.email || "Creator"}
                        {r.roleName ? ` · ${String(r.roleName)}` : ""}
                      </p>
                      <p className="text-xs text-slate-500">{fmtDate(String(r.createdAt || ""))}</p>
                    </div>
                    <StatusPill status={String(r.status || "")} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-white">Audition submissions</h3>
          {!(data.auditionSubmissions || []).length ? (
            <p className="text-sm text-slate-500">None</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(data.auditionSubmissions || []).map((s) => {
                const talent = s.talent as { name?: string } | undefined;
                const post = s.auditionPost as { roleName?: string } | undefined;
                return (
                  <li key={String(s.id)} className="flex justify-between gap-2 border-b border-slate-800/60 py-2">
                    <span className="text-slate-200">
                      {talent?.name || "Talent"} · {post?.roleName || "role"}
                    </span>
                    <StatusPill status={String(s.status || "")} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }
  if (type === "locations" || type === "catering") {
    const rows = data.bookings || [];
    if (!rows.length) return <p className="text-sm text-slate-500">No bookings.</p>;
    return (
      <ul className="space-y-2 text-sm">
        {rows.map((b) => {
          const requester =
            (b.requester as { name?: string | null; email?: string | null } | undefined) ||
            (b.creator as { name?: string | null; email?: string | null } | undefined);
          const listing = b.location as { name?: string } | undefined;
          return (
            <li key={String(b.id)} className="flex justify-between gap-2 border-b border-slate-800/60 py-2">
              <div>
                <p className="text-slate-200">
                  {listing?.name || "Booking"} · {requester?.name || requester?.email || "Creator"}
                  {b.quotedAmount != null ? ` · R${b.quotedAmount}` : ""}
                </p>
                <p className="text-xs text-slate-500">{fmtDate(String(b.createdAt || ""))}</p>
              </div>
              <StatusPill status={String(b.status || "")} />
            </li>
          );
        })}
      </ul>
    );
  }
  const rows = data.requests || [];
  if (!rows.length) return <p className="text-sm text-slate-500">No requests.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => {
        const requester = r.requester as { name?: string | null; email?: string | null } | undefined;
        const equipment = r.equipment as { companyName?: string; category?: string } | undefined;
        return (
          <li key={String(r.id)} className="flex justify-between gap-2 border-b border-slate-800/60 py-2">
            <div>
              <p className="text-slate-200">
                {equipment?.companyName || equipment?.category || "Equipment"} · {requester?.name || requester?.email}
              </p>
              <p className="text-xs text-slate-500">{fmtDate(String(r.createdAt || ""))}</p>
            </div>
            <StatusPill status={String(r.status || "")} />
          </li>
        );
      })}
    </ul>
  );
}
