import { getFocusableElements, getSpatialNavRoot } from "./focusable";

export type SpatialDirection = "up" | "down" | "left" | "right";

function directionFilter(
  direction: SpatialDirection,
  dx: number,
  dy: number,
): boolean {
  const threshold = 4;
  switch (direction) {
    case "left":
      return dx < -threshold;
    case "right":
      return dx > threshold;
    case "up":
      return dy < -threshold;
    case "down":
      return dy > threshold;
  }
}

export function findSpatialTarget(
  current: HTMLElement,
  direction: SpatialDirection,
  root: ParentNode = getSpatialNavRoot(),
): HTMLElement | null {
  const currentRect = current.getBoundingClientRect();
  const cx = currentRect.left + currentRect.width / 2;
  const cy = currentRect.top + currentRect.height / 2;

  const candidates = getFocusableElements(root).filter((el) => el !== current);
  let best: { el: HTMLElement; score: number } | null = null;

  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    const tx = rect.left + rect.width / 2;
    const ty = rect.top + rect.height / 2;
    const dx = tx - cx;
    const dy = ty - cy;

    if (!directionFilter(direction, dx, dy)) continue;

    const primary =
      direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
    const secondary =
      direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 2.5;

    if (!best || score < best.score) {
      best = { el, score };
    }
  }

  return best?.el ?? null;
}

export function focusSpatialTarget(el: HTMLElement): void {
  el.focus({ preventScroll: false });
  el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

export function moveSpatialFocus(
  direction: SpatialDirection,
  root?: ParentNode,
): boolean {
  const active = document.activeElement as HTMLElement | null;
  const focusables = getFocusableElements(root ?? getSpatialNavRoot());
  if (focusables.length === 0) return false;

  if (!active || !focusables.includes(active)) {
    focusSpatialTarget(focusables[0]!);
    return true;
  }

  const next = findSpatialTarget(active, direction, root);
  if (!next) return false;
  focusSpatialTarget(next);
  return true;
}

export function scrollSpatialRow(direction: "left" | "right"): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  const row = active.closest<HTMLElement>('[data-spatial-nav="row"]');
  if (!row) return false;
  const amount = row.clientWidth * 0.75;
  row.scrollBy({
    left: direction === "left" ? -amount : amount,
    behavior: "smooth",
  });
  return true;
}
