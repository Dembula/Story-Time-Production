import "server-only";

import { searchWeb, type WebSearchResult } from "@/lib/modoc/web-search";

export type IndustryNewsArticle = {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  sourceHost: string;
  publishedLabel: string | null;
  provider: WebSearchResult["source"];
};

export type IndustryNewsPayload = {
  articles: IndustryNewsArticle[];
  sources: Array<{ name: string; host: string; count: number }>;
  fetchedAt: string;
  refreshed: boolean;
  staleAfterMinutes: number;
  queryFocus: string;
};

const CACHE_TTL_MS = 30 * 60 * 1000;
const STALE_AFTER_MINUTES = 30;

const FOCUS_QUERIES = [
  "South Africa film industry news this week",
  "NFVF South African film funding cinema production news",
  "South Africa film festival Durban FilmMart Encounters Cape Town film news",
  "South African streaming film television production industry update",
] as const;

const SOURCE_LABELS: Record<string, string> = {
  "screenafrica.com": "Screen Africa",
  "nfvf.co.za": "NFVF",
  "variety.com": "Variety",
  "deadline.com": "Deadline",
  "iol.com": "IOL",
  "iol.co.za": "IOL",
  "news24.com": "News24",
  "dailymaverick.co.za": "Daily Maverick",
  "mg.co.za": "Mail & Guardian",
  "bizcommunity.com": "Bizcommunity",
  "filmcontact.com": "FilmContact",
  "sowetanlive.co.za": "SowetanLIVE",
  "timeslive.co.za": "TimesLIVE",
  "theguardian.com": "The Guardian",
  "bbc.com": "BBC",
  "bbc.co.uk": "BBC",
  "reuters.com": "Reuters",
  "hollywoodreporter.com": "Hollywood Reporter",
};

type CacheBox = {
  payload: IndustryNewsPayload;
  expiresAt: number;
};

let cache: CacheBox | null = null;

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function sourceNameForHost(host: string): string {
  if (!host) return "Web source";
  if (SOURCE_LABELS[host]) return SOURCE_LABELS[host];
  const parts = host.split(".");
  const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return core
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function articleId(url: string, title: string): string {
  const raw = `${url}|${title}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return `news-${hash.toString(36)}`;
}

function looksSaFilmRelevant(title: string, snippet: string, host: string): boolean {
  const blob = `${title} ${snippet} ${host}`.toLowerCase();
  const sa =
    /\b(south africa|south african|sa\b|nfvf|gauteng|cape town|durban|joburg|johannesburg|kwazulu|western cape|eastern cape)\b/.test(
      blob,
    );
  const film =
    /\b(film|cinema|movie|series|festival|production|shoot|streaming|nfvf|documentary|screen|television|tv|cast|director|screenwriter|hollywood)\b/.test(
      blob,
    );
  return sa && film;
}

function mapResult(r: WebSearchResult): IndustryNewsArticle | null {
  const url = (r.url || "").trim();
  const title = (r.title || "").trim();
  const summary = (r.snippet || "").trim();
  if (!url || !title) return null;
  const host = hostFromUrl(url);
  if (!looksSaFilmRelevant(title, summary, host)) return null;
  return {
    id: articleId(url, title),
    title,
    summary: summary || "Open the source for the full report.",
    url,
    sourceName: sourceNameForHost(host),
    sourceHost: host || "unknown",
    publishedLabel: null,
    provider: r.source,
  };
}

function buildSources(articles: IndustryNewsArticle[]) {
  const map = new Map<string, { name: string; host: string; count: number }>();
  for (const a of articles) {
    const key = a.sourceHost || a.sourceName;
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { name: a.sourceName, host: a.sourceHost, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

async function collectLiveArticles(max = 12): Promise<IndustryNewsArticle[]> {
  const seen = new Set<string>();
  const out: IndustryNewsArticle[] = [];

  for (const query of FOCUS_QUERIES) {
    if (out.length >= max) break;
    const batch = await searchWeb(query, 6);
    for (const row of batch) {
      const mapped = mapResult(row);
      if (!mapped) continue;
      const key = mapped.url.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(mapped);
      if (out.length >= max) break;
    }
  }

  return out;
}

/** Static fallback so the panel never looks empty if search providers are down. */
function curatedFallback(): IndustryNewsArticle[] {
  const items = [
    {
      title: "NFVF — National Film and Video Foundation",
      summary:
        "Track funding windows, transformation programmes, and official SA film development updates from the National Film and Video Foundation.",
      url: "https://www.nfvf.co.za/",
      host: "nfvf.co.za",
    },
    {
      title: "Screen Africa — industry news",
      summary:
        "Production, festival, and distribution coverage focused on the African screen industries, including South Africa.",
      url: "https://www.screenafrica.com/",
      host: "screenafrica.com",
    },
    {
      title: "Bizcommunity Media & Entertainment",
      summary:
        "South African media and entertainment business news spanning film, TV, advertising, and streaming.",
      url: "https://www.bizcommunity.com/Category/196/15.html",
      host: "bizcommunity.com",
    },
  ] as const;

  return items.map((item) => ({
    id: articleId(item.url, item.title),
    title: item.title,
    summary: item.summary,
    url: item.url,
    sourceName: sourceNameForHost(item.host),
    sourceHost: item.host,
    publishedLabel: "Hub",
    provider: "duckduckgo" as const,
  }));
}

export async function getCreatorIndustryNews(opts?: {
  forceRefresh?: boolean;
}): Promise<IndustryNewsPayload> {
  const force = Boolean(opts?.forceRefresh);
  const now = Date.now();
  if (!force && cache && cache.expiresAt > now) {
    return { ...cache.payload, refreshed: false };
  }

  let articles: IndustryNewsArticle[] = [];
  try {
    articles = await collectLiveArticles(12);
  } catch {
    articles = [];
  }
  if (articles.length === 0) articles = curatedFallback();

  const payload: IndustryNewsPayload = {
    articles,
    sources: buildSources(articles),
    fetchedAt: new Date().toISOString(),
    refreshed: true,
    staleAfterMinutes: STALE_AFTER_MINUTES,
    queryFocus: "South African film & screen industry",
  };

  cache = { payload, expiresAt: now + CACHE_TTL_MS };
  return payload;
}

/** Best-effort full-text extract for in-panel reading (same-origin server fetch). */
export async function extractArticleBody(urlRaw: string): Promise<{
  ok: boolean;
  title?: string;
  text?: string;
  sourceName?: string;
  sourceHost?: string;
  error?: string;
}> {
  let url: URL;
  try {
    url = new URL(urlRaw);
  } catch {
    return { ok: false, error: "Invalid article URL." };
  }
  if (!/^https?:$/i.test(url.protocol)) {
    return { ok: false, error: "Only http(s) article links are supported." };
  }

  const host = hostFromUrl(url.toString());
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "StoryTimeUniverseCreatorNews/1.0 (+https://story-time.online)",
      },
      signal: controller.signal,
      next: { revalidate: 3600 },
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      return {
        ok: false,
        error: `Source returned ${res.status}. Open the original link instead.`,
        sourceHost: host,
        sourceName: sourceNameForHost(host),
      };
    }
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim();
    const text = htmlToReadableText(html);
    if (text.length < 120) {
      return {
        ok: false,
        error: "Could not extract a readable article body from this source.",
        title,
        sourceHost: host,
        sourceName: sourceNameForHost(host),
      };
    }
    return {
      ok: true,
      title,
      text: text.slice(0, 12_000),
      sourceHost: host,
      sourceName: sourceNameForHost(host),
    };
  } catch {
    return {
      ok: false,
      error: "Timed out fetching this article. Open the original source instead.",
      sourceHost: host,
      sourceName: sourceNameForHost(host),
    };
  }
}

function htmlToReadableText(html: string): string {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const articleMatch =
    cleaned.match(/<article[\s\S]*?<\/article>/i) ||
    cleaned.match(/<main[\s\S]*?<\/main>/i);
  if (articleMatch) cleaned = articleMatch[0];

  return cleaned
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
