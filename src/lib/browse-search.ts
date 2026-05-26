export type SearchableContent = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  type: string;
  tags: string | null;
  creator?: { name: string | null } | null;
};

export function scoreSearchMatch(item: SearchableContent, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const title = item.title.toLowerCase();
  const desc = (item.description ?? "").toLowerCase();
  const category = (item.category ?? "").toLowerCase();
  const tags = (item.tags ?? "").toLowerCase();
  const type = item.type.toLowerCase();
  const creator = (item.creator?.name ?? "").toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);

  let score = 0;
  if (title === q) score += 100;
  else if (title.startsWith(q)) score += 70;
  else if (title.includes(q)) score += 45;

  for (const term of terms) {
    if (title.includes(term)) score += 20;
    if (category.includes(term)) score += 15;
    if (type.includes(term)) score += 12;
    if (tags.includes(term)) score += 10;
    if (creator.includes(term)) score += 18;
    if (desc.includes(term)) score += 8;
  }

  return score;
}

export function rankSearchResults<T extends SearchableContent>(items: T[], query: string): T[] {
  if (!query.trim()) return items;
  return [...items]
    .map((item) => ({ item, score: scoreSearchMatch(item, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
