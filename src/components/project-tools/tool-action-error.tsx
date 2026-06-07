"use client";

interface ToolActionErrorProps {
  message: string | null | undefined;
  onDismiss?: () => void;
}

export function ToolActionError({ message, onDismiss }: ToolActionErrorProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200"
    >
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-red-300/80 hover:text-red-100"
          aria-label="Dismiss error"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
