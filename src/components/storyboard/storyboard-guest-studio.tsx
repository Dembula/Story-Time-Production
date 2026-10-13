"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clapperboard, Loader2, Maximize2 } from "lucide-react";
import { StoryboardPresenter } from "@/components/storyboard/storyboard-presenter";

type Preview = {
  boardTitle: string;
  projectTitle: string;
  stylePreset: string;
  aspectRatio: string;
  durationLabel: string;
  expiresAt: string | null;
};

export function StoryboardGuestStudio({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [presenting, setPresenting] = useState(false);

  const previewQuery = useQuery({
    queryKey: ["storyboard-guest-preview", token],
    queryFn: async () => {
      const res = await fetch(`/api/storyboard/guest/${encodeURIComponent(token)}/preview`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Invite unavailable");
      return j as Preview;
    },
  });

  const sessionQuery = useQuery({
    queryKey: ["storyboard-guest-session"],
    queryFn: async () => {
      const res = await fetch("/api/storyboard/guest/session");
      if (res.status === 401) return null;
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Session error");
      return j as {
        guestName: string;
        board: {
          title: string;
          projectTitle: string;
          aspectRatio: string;
          frames: Array<{
            id: string;
            shotLabel: string | null;
            sceneHeading: string | null;
            directorNotes: string | null;
            imageUrl: string | null;
          }>;
        };
      };
    },
    enabled: joined || true,
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/storyboard/guest/${encodeURIComponent(token)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestName: name.trim(), guestEmail: email.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || "Could not join");
      return j;
    },
    onSuccess: async () => {
      setJoined(true);
      await sessionQuery.refetch();
    },
  });

  const session = sessionQuery.data;
  if (session?.board) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl space-y-6 bg-[#0b0b0c] px-4 py-8 text-slate-100">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-400/80">Guest storyboard</p>
            <h1 className="text-2xl font-semibold text-white">{session.board.title}</h1>
            <p className="text-sm text-slate-400">
              {session.board.projectTitle} · viewing as {session.guestName} · view only
            </p>
          </div>
          {session.board.frames.length > 0 ? (
            <button
              type="button"
              onClick={() => setPresenting(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:border-orange-500/40"
            >
              <Maximize2 className="h-4 w-4" /> Present
            </button>
          ) : null}
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {session.board.frames.map((frame) => (
            <article
              key={frame.id}
              className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40"
            >
              <div className="aspect-video bg-black">
                {frame.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={frame.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-600">
                    No image
                  </div>
                )}
              </div>
              <div className="space-y-1 px-3 py-2">
                <p className="text-sm font-medium text-white">{frame.shotLabel}</p>
                <p className="text-xs text-slate-500">{frame.sceneHeading}</p>
                {frame.directorNotes ? (
                  <p className="text-xs text-slate-400">{frame.directorNotes}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        {presenting ? (
          <StoryboardPresenter
            title={session.board.title}
            subtitle={session.board.projectTitle}
            frames={session.board.frames}
            onClose={() => setPresenting(false)}
          />
        ) : null}
      </main>
    );
  }

  if (previewQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0c] text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (previewQuery.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0c] px-4 text-center text-slate-300">
        <div>
          <Clapperboard className="mx-auto mb-3 h-8 w-8 text-slate-600" />
          <p>{(previewQuery.error as Error).message}</p>
        </div>
      </div>
    );
  }

  const preview = previewQuery.data!;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0c] px-4 py-10 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-400/80">Story Time</p>
        <h1 className="mt-2 text-xl font-semibold text-white">{preview.boardTitle}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {preview.projectTitle} · {preview.durationLabel} view-only access
        </p>
        <div className="mt-5 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white"
          />
          {joinMutation.error ? (
            <p className="text-xs text-red-300">{(joinMutation.error as Error).message}</p>
          ) : null}
          <button
            type="button"
            disabled={!name.trim() || joinMutation.isPending}
            onClick={() => void joinMutation.mutate()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50"
          >
            {joinMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enter storyboard
          </button>
        </div>
      </div>
    </main>
  );
}
