"use client";

import { UPLOAD_CREDIT_ROLE_GROUPS } from "@/lib/upload-credit-roles";

type UploadCreditRoleSelectProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
};

const baseClass =
  "min-w-[15rem] max-w-[20rem] flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm focus:border-orange-500 focus:outline-none transition";

export function UploadCreditRoleSelect({
  value,
  onChange,
  className = "",
  id,
}: UploadCreditRoleSelectProps) {
  const hasValue = value && UPLOAD_CREDIT_ROLE_GROUPS.some((g) => g.roles.some((r) => r.value === value));

  return (
    <select
      id={id}
      value={hasValue ? value : value ? "__custom__" : ""}
      onChange={(e) => {
        const next = e.target.value;
        if (next === "__custom__") return;
        onChange(next);
      }}
      className={`${baseClass} ${className}`.trim()}
    >
      <option value="">Select credit / role</option>
      {UPLOAD_CREDIT_ROLE_GROUPS.map((group) => (
        <optgroup key={group.category} label={group.category}>
          {group.roles.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </optgroup>
      ))}
      {value && !hasValue ? (
        <option value="__custom__">{value} (saved)</option>
      ) : null}
    </select>
  );
}
