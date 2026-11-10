"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MeetJoinByCodeClient() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4 rounded-2xl border border-white/10 bg-[#121214] p-6 shadow-2xl"
      onSubmit={(e) => {
        e.preventDefault();
        const cleaned = code.trim().toUpperCase();
        if (cleaned.length < 4) {
          setError("Enter a valid meeting code");
          return;
        }
        setError(null);
        const qs = passcode.trim()
          ? `?passcode=${encodeURIComponent(passcode.trim())}`
          : "";
        router.push(`/meet/${cleaned}${qs}`);
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-slate-300">Meeting code</span>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ST-XXXXXX"
          className="border-white/10 bg-black/40 font-mono tracking-wider text-white"
          required
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-slate-300">
          Passcode <span className="text-slate-500">(if required)</span>
        </span>
        <Input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Optional"
          className="border-white/10 bg-black/40 text-white"
        />
      </label>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <Button type="submit" className="w-full bg-orange-500 text-white hover:bg-orange-400">
        Open lobby
      </Button>
    </form>
  );
}
