"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ContractInAppResponseAction = "ACCEPT" | "REJECT" | "REQUEST_CHANGES";

const RESPONSE_OPTIONS: Array<{
  value: ContractInAppResponseAction;
  label: string;
  description: string;
  tone: string;
}> = [
  {
    value: "ACCEPT",
    label: "Approve & sign",
    description: "I agree to the terms and sign this contract in-app.",
    tone: "border-emerald-500/40 bg-emerald-500/5",
  },
  {
    value: "REQUEST_CHANGES",
    label: "Request changes / renegotiate",
    description: "I need revisions before I can approve.",
    tone: "border-amber-500/40 bg-amber-500/5",
  },
  {
    value: "REJECT",
    label: "Decline",
    description: "I do not accept this contract.",
    tone: "border-rose-500/40 bg-rose-500/5",
  },
];

type Props = {
  signerName: string;
  onSignerNameChange: (value: string) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  selectedAction: ContractInAppResponseAction | null;
  onSelectAction: (value: ContractInAppResponseAction) => void;
  confirmed: boolean;
  onConfirmedChange: (value: boolean) => void;
  onSubmit: () => void;
  pending?: boolean;
  title?: string;
};

export function ContractInAppResponsePanel({
  signerName,
  onSignerNameChange,
  comment,
  onCommentChange,
  selectedAction,
  onSelectAction,
  confirmed,
  onConfirmedChange,
  onSubmit,
  pending,
  title = "Your response",
}: Props) {
  const needsComment = selectedAction === "REQUEST_CHANGES" || selectedAction === "REJECT";
  const canSubmit =
    !!selectedAction &&
    confirmed &&
    signerName.trim().length > 0 &&
    (!needsComment || comment.trim().length > 0);

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-xs text-slate-400">
          Select one option below and tick the confirmation box. No external e-sign service is required.
        </p>
      </div>

      <div className="space-y-2">
        {RESPONSE_OPTIONS.map((opt) => {
          const selected = selectedAction === opt.value;
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
                selected ? opt.tone : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name="contract-response"
                checked={selected}
                onChange={() => onSelectAction(opt.value)}
                className="mt-1 h-4 w-4 accent-orange-500"
              />
              <span>
                <span className="block text-sm font-medium text-slate-100">{opt.label}</span>
                <span className="block text-xs text-slate-400">{opt.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="space-y-2">
        <label className="text-xs text-slate-400">Full legal name</label>
        <Input
          value={signerName}
          onChange={(e) => onSignerNameChange(e.target.value)}
          placeholder="Type your name to confirm this response"
          className="bg-slate-950 border-slate-700"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-slate-400">
          {needsComment ? "Comment (required for decline or change requests)" : "Optional comment"}
        </label>
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Add notes for the production team…"
          rows={3}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirmedChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded accent-orange-500"
        />
        <span className="text-xs text-slate-300">
          I confirm this is my official response to this contract and I understand it will be recorded in the project audit log.
        </span>
      </label>

      <Button
        type="button"
        className="bg-orange-500 hover:bg-orange-600"
        disabled={!canSubmit || pending}
        onClick={onSubmit}
      >
        {pending ? "Submitting…" : "Submit response"}
      </Button>
    </div>
  );
}
