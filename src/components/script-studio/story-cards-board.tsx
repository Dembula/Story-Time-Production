"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import type { StoryCardMeta } from "@/lib/script-studio/story-cards";

type StoryCardsBoardProps = {
  scriptId: string | null | undefined;
  canWrite: boolean;
  scenes: Array<{ id: string; number: number; heading: string }>;
  onReorderScenes?: (orderedHeadings: string[]) => void;
};

function cardFromScene(scene: { number: number; heading: string }, index: number): StoryCardMeta {
  return {
    id: `card-${scene.number}`,
    orderIndex: index,
    title: `Scene ${scene.number}`,
    description: scene.heading,
    sceneHeading: scene.heading,
    status: "draft",
    color: "#f97316",
  };
}

export function StoryCardsBoard({
  scriptId,
  canWrite,
  scenes,
}: StoryCardsBoardProps) {
  const queryClient = useQueryClient();
  const [cards, setCards] = useState<StoryCardMeta[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data } = useQuery({
    enabled: !!scriptId,
    queryKey: ["script-studio-meta", scriptId],
    queryFn: () =>
      fetch(`/api/creator/scripts/${scriptId}/studio-meta`).then((r) => r.json()),
  });

  useEffect(() => {
    const saved = (data?.storyCards ?? []) as StoryCardMeta[];
    if (saved.length > 0) {
      setCards(saved);
    } else if (scenes.length > 0) {
      setCards(scenes.map((s, i) => cardFromScene(s, i)));
    }
  }, [data?.storyCards, scenes]);

  const saveMutation = useMutation({
    mutationFn: async (next: StoryCardMeta[]) => {
      const res = await fetch(`/api/creator/scripts/${scriptId}/studio-meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyCards: next }),
      });
      if (!res.ok) throw new Error("Failed to save story cards");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["script-studio-meta", scriptId] });
    },
  });

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId || !canWrite) return;
    const from = cards.findIndex((c) => c.id === dragId);
    const to = cards.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...cards];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const reindexed = next.map((c, i) => ({ ...c, orderIndex: i }));
    setCards(reindexed);
    saveMutation.mutate(reindexed);
    setDragId(null);
  };

  if (!scriptId) {
    return <p className="text-[11px] text-slate-500">Select a script for story cards.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-500">
        Corkboard view — drag cards to reorder beats. Syncs with scene list.
      </p>
      <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto">
        {cards.map((card) => (
          <div
            key={card.id}
            draggable={canWrite}
            onDragStart={() => setDragId(card.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(card.id)}
            className="rounded-lg border border-slate-700 bg-slate-900/80 p-2 cursor-grab active:cursor-grabbing"
            style={{ borderLeftColor: card.color ?? "#f97316", borderLeftWidth: 4 }}
          >
            <p className="text-xs font-medium text-slate-100">{card.title}</p>
            <p className="text-[10px] text-slate-400 mt-1 line-clamp-3">
              {card.description || card.sceneHeading}
            </p>
            {card.objective ? (
              <p className="text-[10px] text-slate-500 mt-1">Objective: {card.objective}</p>
            ) : null}
          </div>
        ))}
      </div>
      {canWrite ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full border-slate-600 text-[10px] text-slate-100"
          onClick={() => {
            const fromScenes = scenes.map((s, i) => cardFromScene(s, i));
            setCards(fromScenes);
            saveMutation.mutate(fromScenes);
          }}
        >
          Refresh cards from scenes
        </Button>
      ) : null}
    </div>
  );
}
