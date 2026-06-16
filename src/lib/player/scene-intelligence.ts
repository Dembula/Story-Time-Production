export type PlaybackScene = {
  id: string;
  startSeconds: number;
  endSeconds: number;
  summary: string | null;
  mood: string | null;
  actors: unknown;
};

export function parseSceneActors(actors: unknown): string[] {
  if (Array.isArray(actors)) {
    return actors.filter((a): a is string => typeof a === "string" && a.trim().length > 0);
  }
  if (typeof actors === "string" && actors.trim()) return [actors.trim()];
  return [];
}

export function formatSceneActorsLabel(actors: unknown): string | null {
  const list = parseSceneActors(actors);
  if (list.length === 0) return null;
  return list.length === 1 ? `On screen: ${list[0]}` : `On screen: ${list.join(", ")}`;
}

export function formatActiveSceneLabel(scene: PlaybackScene | undefined): string | null {
  if (!scene) return null;
  const actors = formatSceneActorsLabel(scene.actors);
  if (actors) return actors;
  if (scene.summary?.trim()) return scene.summary.trim();
  if (scene.mood?.trim()) return scene.mood.trim();
  return null;
}

export function findActiveScene(
  scenes: PlaybackScene[],
  currentTime: number,
): PlaybackScene | undefined {
  return scenes.find((s) => currentTime >= s.startSeconds && currentTime < s.endSeconds);
}
