import { Suspense } from "react";
import { NetworkClient } from "./network-client";

export default function NetworkPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
      <NetworkClient />
    </Suspense>
  );
}
