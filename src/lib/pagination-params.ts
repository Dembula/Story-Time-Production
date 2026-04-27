/** Shared list pagination for marketplace transaction APIs (take/skip query params). */

const DEFAULT_TAKE = 50;
const MAX_TAKE = 100;

export function parseTakeSkip(searchParams: URLSearchParams): { take: number; skip: number } {
  const rawTake = searchParams.get("take");
  const rawSkip = searchParams.get("skip");
  let take = rawTake == null || rawTake === "" ? DEFAULT_TAKE : Number.parseInt(rawTake, 10);
  let skip = rawSkip == null || rawSkip === "" ? 0 : Number.parseInt(rawSkip, 10);
  if (!Number.isFinite(take) || take < 1) take = DEFAULT_TAKE;
  if (!Number.isFinite(skip) || skip < 0) skip = 0;
  take = Math.min(MAX_TAKE, Math.floor(take));
  skip = Math.floor(skip);
  return { take, skip };
}
