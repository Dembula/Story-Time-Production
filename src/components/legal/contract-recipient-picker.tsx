"use client";

import { useMemo, useState } from "react";
import { Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RECIPIENT_TYPES, recipientTypeLabel, type RecipientType } from "@/lib/contract-lifecycle";

export type RecipientOption = {
  id: string;
  label: string;
  sublabel?: string;
  recipientType: RecipientType;
  counterpartyUserId: string | null;
  email?: string | null;
  source: "resource" | "member" | "manual";
};

type ContractRecipientPickerProps = {
  options: RecipientOption[];
  recipientType: RecipientType;
  counterpartyUserId: string | null;
  recipientLabel: string;
  recipientEmail: string;
  onRecipientTypeChange: (type: RecipientType) => void;
  onSelect: (option: RecipientOption | null) => void;
  onManualLabelChange: (label: string) => void;
  onManualEmailChange: (email: string) => void;
};

export function ContractRecipientPicker({
  options,
  recipientType,
  counterpartyUserId,
  recipientLabel,
  recipientEmail,
  onRecipientTypeChange,
  onSelect,
  onManualLabelChange,
  onManualEmailChange,
}: ContractRecipientPickerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 30);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.sublabel?.toLowerCase().includes(q) ||
          o.email?.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [options, query]);

  const selectedId =
    options.find((o) => o.counterpartyUserId && o.counterpartyUserId === counterpartyUserId)?.id ??
    (recipientLabel && !counterpartyUserId ? "manual" : "");

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Recipient</p>
      <div className="grid gap-2 md:grid-cols-2">
        <select
          value={recipientType}
          onChange={(e) => onRecipientTypeChange(e.target.value as RecipientType)}
          className="h-10 rounded-md bg-slate-900 border border-slate-700 px-2 text-sm text-white"
        >
          {RECIPIENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {recipientTypeLabel(t)}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cast, crew, vendors…"
            className="h-10 bg-slate-900 border-slate-700 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="max-h-40 overflow-y-auto space-y-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">No matches — enter recipient details below.</p>
        ) : (
          filtered.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt)}
              className={`w-full flex items-start gap-2 rounded-md px-2 py-2 text-left text-xs transition ${
                selectedId === opt.id
                  ? "bg-orange-500/15 border border-orange-500/40 text-orange-100"
                  : "border border-transparent hover:bg-slate-800/80 text-slate-200"
              }`}
            >
              <User className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-500" />
              <span>
                <span className="font-medium">{opt.label}</span>
                {opt.sublabel && <span className="block text-slate-500">{opt.sublabel}</span>}
                {!opt.counterpartyUserId && opt.email && (
                  <span className="block text-amber-200/80">No platform account — email required to send</span>
                )}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-2 pt-1 border-t border-slate-800">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500">Recipient name (manual)</label>
          <Input
            value={recipientLabel}
            onChange={(e) => {
              onManualLabelChange(e.target.value);
              if (!counterpartyUserId) onSelect(null);
            }}
            placeholder="Full name or company"
            className="h-9 bg-slate-900 border-slate-700 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500">Email (if no platform account)</label>
          <Input
            type="email"
            value={recipientEmail}
            onChange={(e) => onManualEmailChange(e.target.value)}
            placeholder="recipient@example.com"
            className="h-9 bg-slate-900 border-slate-700 text-xs"
          />
        </div>
      </div>

      {!counterpartyUserId && !recipientEmail.trim() && recipientLabel.trim() && (
        <p className="text-[10px] text-amber-200/90">
          Add an email or select a verified platform user before sending.
        </p>
      )}
    </div>
  );
}
