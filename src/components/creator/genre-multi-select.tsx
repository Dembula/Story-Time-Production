"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { CATALOGUE_GENRES } from "@/lib/catalogue-genres";

type GenreMultiSelectProps = {
  value: string[];
  onChange: (next: string[]) => void;
  options?: readonly string[];
  label?: string;
  placeholder?: string;
};

export function GenreMultiSelect({
  value,
  onChange,
  options = CATALOGUE_GENRES,
  label = "Genres (select all that apply)",
  placeholder = "Search genres…",
}: GenreMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...options];
    return options.filter((g) => g.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  function toggle(genre: string) {
    if (selected.has(genre)) {
      onChange(value.filter((g) => g !== genre));
    } else {
      onChange([...value, genre]);
    }
  }

  function remove(genre: string) {
    onChange(value.filter((g) => g !== genre));
  }

  return (
    <div ref={rootRef} className="relative space-y-2">
      <label className="block text-sm font-medium text-slate-300">{label}</label>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((g) => (
            <span
              key={g}
              className="inline-flex items-center gap-1 rounded-lg border border-orange-400/30 bg-orange-500/15 px-2 py-1 text-xs text-orange-100"
            >
              {g}
              <button
                type="button"
                onClick={() => remove(g)}
                className="rounded p-0.5 text-orange-200/80 hover:bg-orange-500/20 hover:text-white"
                aria-label={`Remove ${g}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-left text-sm text-white transition hover:border-orange-500/50 focus:border-orange-500 focus:outline-none"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={value.length ? "text-slate-200" : "text-slate-500"}>
          {value.length
            ? `${value.length} genre${value.length === 1 ? "" : "s"} selected`
            : "Choose genres…"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-xl border border-white/12 bg-black/95 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              aria-label="Search genres"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded p-1 text-slate-500 hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <ul
            role="listbox"
            aria-multiselectable="true"
            className="max-h-64 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-xs text-slate-500">No genres match “{query.trim()}”.</li>
            ) : (
              filtered.map((g) => {
                const isOn = selected.has(g);
                return (
                  <li key={g} role="option" aria-selected={isOn}>
                    <button
                      type="button"
                      onClick={() => toggle(g)}
                      className={[
                        "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition",
                        isOn
                          ? "bg-orange-500/15 text-orange-100"
                          : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                      ].join(" ")}
                    >
                      <span>{g}</span>
                      {isOn ? <Check className="h-4 w-4 shrink-0 text-orange-300" /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="flex items-center justify-between border-t border-white/8 px-3 py-2">
            <p className="text-[10px] text-slate-500">
              {filtered.length} shown · {value.length} selected
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery("");
              }}
              className="text-[11px] font-medium text-orange-300 hover:text-orange-200"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
