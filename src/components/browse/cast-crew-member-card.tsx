"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Film, Loader2 } from "lucide-react";

type PersonTitle = {
  id: string;
  title: string;
  type: string;
  year: number | null;
  category: string | null;
  posterUrl: string | null;
};

type PersonPayload = {
  name: string;
  role: string | null;
  bio: string | null;
  titles: PersonTitle[];
};

export function CastCrewMemberCard({
  member,
  excludeContentId,
}: {
  member: { id: string; name: string; role: string; bio: string | null };
  excludeContentId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [person, setPerson] = useState<PersonPayload | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const fetchPerson = useCallback(async () => {
    if (person) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        name: member.name,
        exclude: excludeContentId,
      });
      const res = await fetch(`/api/browse/people?${params}`);
      if (res.ok) {
        setPerson(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [member.name, excludeContentId, person]);

  const onEnter = () => {
    hoverTimer.current = setTimeout(() => {
      setOpen(true);
      void fetchPerson();
    }, 280);
  };

  const onLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  const initials = member.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      ref={cardRef}
      className="relative"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <div className="cursor-default rounded-xl border border-slate-700/30 bg-slate-800/40 p-3 transition hover:border-orange-500/30 hover:bg-slate-800/70">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/30 to-cyan-500/20 text-sm font-semibold text-white">
          {initials}
        </div>
        <p className="text-sm font-medium text-white">{member.name}</p>
        <p className="text-xs text-orange-400">{member.role}</p>
        {member.bio && !open && (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{member.bio}</p>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border border-white/10 bg-[#0c121c] p-4 shadow-2xl">
          <p className="font-semibold text-white">{member.name}</p>
          <p className="text-xs text-orange-400">{member.role}</p>
          {(person?.bio || member.bio) && (
            <p className="mt-2 line-clamp-3 text-xs text-slate-400">{person?.bio ?? member.bio}</p>
          )}
          {loading && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading titles…
            </div>
          )}
          {!loading && person && person.titles.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">More titles</p>
              {person.titles.map((t) => (
                <Link
                  key={t.id}
                  href={`/browse/content/${t.id}`}
                  className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-white/5"
                >
                  <div className="relative h-10 w-7 shrink-0 overflow-hidden rounded bg-slate-800">
                    {t.posterUrl ? (
                      <Image src={t.posterUrl} alt="" fill className="object-cover" sizes="28px" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Film className="h-3 w-3 text-slate-600" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white">{t.title}</p>
                    <p className="truncate text-[10px] text-slate-500">
                      {t.type}
                      {t.year ? ` · ${t.year}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {!loading && person && person.titles.length === 0 && (
            <p className="mt-2 text-xs text-slate-500">No other titles on Storytime yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
