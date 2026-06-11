"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

type ToolViewButtonProps = {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
  count?: number;
  className?: string;
};

export function ToolViewButton({
  onClick,
  label = "View",
  disabled,
  count,
  className,
}: ToolViewButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      className={`border-slate-600 text-slate-100 hover:bg-slate-800 text-[11px] gap-1.5 ${className ?? ""}`}
    >
      <Eye className="h-3.5 w-3.5 opacity-80" />
      {label}
      {count != null && count > 0 ? (
        <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-normal text-slate-300">
          {count}
        </span>
      ) : null}
    </Button>
  );
}
