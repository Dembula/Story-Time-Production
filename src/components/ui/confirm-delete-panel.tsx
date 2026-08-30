"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDeletePanelProps = {
  /** Short label shown in the danger zone, e.g. "Delete idea" */
  label: string;
  /** Exact phrase the user must type (case-insensitive). */
  confirmPhrase: string;
  /** Optional longer warning under the title. */
  description?: string;
  /** Compact inline button+panel vs full danger-zone block. */
  variant?: "block" | "inline";
  disabled?: boolean;
  pending?: boolean;
  className?: string;
  onConfirm: () => void | Promise<void>;
};

/**
 * Two-step destructive action: click delete → type confirm phrase → permanently delete.
 */
export function ConfirmDeletePanel({
  label,
  confirmPhrase,
  description,
  variant = "block",
  disabled,
  pending,
  className,
  onConfirm,
}: ConfirmDeletePanelProps) {
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const matches = text.trim().toLowerCase() === confirmPhrase.trim().toLowerCase();

  const reset = () => {
    setStep("idle");
    setText("");
    setError(null);
  };

  const confirmBody = (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-red-500/30 bg-black/30 p-4",
        variant === "inline" && "mt-2",
      )}
    >
      <p className="text-sm text-slate-200">
        This cannot be undone. Type{" "}
        <span className="font-mono text-red-200">{confirmPhrase}</span> to confirm.
      </p>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onClick={(e) => e.stopPropagation()}
        placeholder={confirmPhrase}
        autoComplete="off"
        className="storytime-input w-full rounded-xl px-3 py-2 font-mono text-sm"
        aria-label={`Type ${confirmPhrase} to confirm`}
      />
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-white/10 text-slate-300"
          disabled={pending}
          onClick={(e) => {
            e.stopPropagation();
            reset();
          }}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-red-600 text-white hover:bg-red-500"
          disabled={!matches || pending || disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!matches) {
              setError(`Type "${confirmPhrase}" exactly to continue.`);
              return;
            }
            void Promise.resolve(onConfirm()).catch((err) => {
              setError(err instanceof Error ? err.message : "Delete failed");
            });
          }}
        >
          {pending ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Deleting…
            </>
          ) : (
            "Permanently delete"
          )}
        </Button>
      </div>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className={cn("min-w-0", className)}>
        {step === "idle" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-red-500/40 text-red-200 hover:bg-red-500/15 hover:text-red-100"
            disabled={disabled || pending}
            onClick={(e) => {
              e.stopPropagation();
              setStep("confirm");
              setText("");
              setError(null);
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </Button>
        ) : (
          confirmBody
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-red-500/25 bg-red-950/20 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-red-300/80">
            Danger zone
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">{label}</h3>
          {description ? (
            <p className="mt-1 max-w-xl text-xs text-slate-400">{description}</p>
          ) : null}
        </div>
        {step === "idle" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-red-500/40 text-red-200 hover:bg-red-500/15 hover:text-red-100"
            disabled={disabled || pending}
            onClick={(e) => {
              e.stopPropagation();
              setStep("confirm");
              setText("");
              setError(null);
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </Button>
        ) : null}
      </div>
      {step === "confirm" ? <div className="mt-4">{confirmBody}</div> : null}
    </div>
  );
}
