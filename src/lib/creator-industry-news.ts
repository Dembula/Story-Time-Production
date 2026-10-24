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
  publishedAt: string | null;
  provider: "rss" | WebSearchResult["source"] | "curated";
  /** Real article vs homepage/hub — hubs skip scrape-on-expand. */
  kind: "article" | "hub";
};

export type IndustryNewsPayload = {
  articles: IndustryNewsArticle[];
  sources: Array<{ name: string; host: string; count: number }>;
  fetchedAt: string;
  refreshed: boolean;
  staleAfterMinutes: number;
  queryFocus: string;
  liveCount: number;
  providerNote: string | null;
};

const CACHE_TTL_MS = 20 * 60 * 1000;
const STALE_AFTER_MINUTES = 20;
const MAX_ARTICLES = 28;
const FETCH_TIMEOUT_MS = 10_000;

/** Google News RSS + a few industry outlet searches — works without Tavily/Serper keys. */
const RSS_FEEDS: Array<{ url: string; label: string }> = [
  {
    label: "SA film",
    url: "https://news.google.com/rss/search?q=%22South+Africa%22+(film+OR+cinema+OR+NFVF+OR+%22film+festival%22+OR+screenplay+OR+filmmaking)&hl=en-ZA&gl=ZA&ceid=ZA:en",
  },
  {
    label: "Screen Africa",
    url: "https://news.google.com/rss/search?q=site:screenafrica.com&hl=en-ZA&gl=ZA&ceid=ZA:en",
  },
  {
    label: "NFVF",
    url: "https://news.google.com/rss/search?q=NFVF+(film+OR+cinema+OR+funding+OR+grant)&hl=en-ZA&gl=ZA&ceid=ZA:en",
  },
  {
    label: "Festivals",
    url: "https://news.google.com/rss/search?q=%22Durban+FilmMart%22+OR+%22Encounters+Documentary%22+OR+%22RapidLion%22+OR+%22Cape+Town+International+Film%22+OR+%22Jozi+Film%22&hl=en-ZA&gl=ZA&ceid=ZA:en",
  },
  {
    label: "Bizcommunity",
    url: "https://news.google.com/rss/search?q=site:bizcommunity.com+(film+OR+cinema+OR+television+OR+streaming)+%22South+Africa%22&hl=en-ZA&gl=ZA&ceid=ZA:en",
  },
  {
    label: "News24 / IOL",
    url: "https://news.google.com/rss/search?q=(site:news24.com+OR+site:iol.co.za)+(film+OR+cinema+OR+movie+OR+Netflix)+%22South+Africa%22&hl=en-ZA&gl=ZA&ceid=ZA:en",
  },
  {
    label: "Daily Maverick / M&G",
    url: "https://news.google.com/rss/search?q=(site:dailymaverick.co.za+OR+site:mg.co.za)+(film+OR+cinema+OR+television)&hl=en-ZA&gl=ZA&ceid=ZA:en",
  },
  {
    label: "Production",
    url: "https://news.google.com/rss/search?q=%22South+Africa%22+(%22film+production%22+OR+%22TV+production%22+OR+filming+OR+%22location+shoot%22)&hl=en-ZA&gl=ZA&ceid=ZA:en",
  },
];

const WEB_FALLBACK_QUERIES = [
  "South Africa film industry news",
  "NFVF South Africa film funding",
  "South African film festival news",
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
  "screendaily.com": "Screen Daily",
  "indiewire.com": "IndieWire",
  "channel24.co.za": "Channel24",
  "ewn.co.za": "EWN",
  "sabcnews.com": "SABC News",
  "enca.com": "eNCA",
  "citizen.co.za": "The Citizen",
  "businesslive.co.za": "BusinessLIVE",
  "techcentral.co.za": "TechCentral",
  "mediaupdate.co.za": "Media Update",
  "themediaonline.co.za": "The Media Online",
  "news.google.com": "Google News",
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
  const core = parts.length >= 2 ? parts[parts.length - 2]! : parts[0]!;
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

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function tagValue(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m?.[1] ? decodeXmlEntities(m[1].trim()) : "";
}

function sourceFromItem(block: string): { name: string; url: string } {
  const m = block.match(/<source[^>]*url=["']([^"']+)["'][^>]*>([\s\S]*?)<\/source>/i);
  if (m) {
    return { url: decodeXmlEntities(m[1] || ""), name: stripHtml(decodeXmlEntities(m[2] || "")) };
  }
  return { url: "", name: "" };
}

function formatPubLabel(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function isHubUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return path === "" || path === "/" || /^\/(news|category|section|media)?\/?$/i.test(path);
  } catch {
    return false;
  }
}

function looksRelevant(title: string, summary: string, host: string): boolean {
  const blob = `${title} ${summary} ${host}`.toLowerCase();
  // Soft filter: keep film/TV/screen industry, prefer SA but allow African screen coverage.
  const film =
    /\b(film|cinema|movie|series|festival|production|shoot|streaming|nfvf|documentary|screen|television|tv|netflix|showmax|cast|director|screenwriter|hollywood|box[\s-]?office)\b/.test(
      blob,
    );
  if (!film) return false;
  const saOrIndustry =
    /\b(south africa|south african|sa\b|nfvf|gauteng|cape town|durban|joburg|johannesburg|africa|african|screenafrica|bizcommunity)\b/.test(
      blob,
    ) ||
    Boolean(
      SOURCE_LABELS[host] ||
        host.endsWith(".za") ||
        host.includes("screenafrica") ||
        host.includes("nfvf") ||
        host.includes("bizcommunity"),
    );
  return saOrIndustry;
}

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5",
        "User-Agent": "StoryTimeUniverseCreatorNews/1.1 (+https://story-time.online)",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseRssItems(xml: string): IndustryNewsArticle[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const out: IndustryNewsArticle[] = [];

  for (const block of items) {
    let title = stripHtml(tagValue(block, "title"));
    // Google News titles often end with " - Source Name"
    let sourceName = "";
    const dash = title.lastIndexOf(" - ");
    if (dash > 20) {
      sourceName = title.slice(dash + 3).trim();
      title = title.slice(0, dash).trim();
    }

    const link = stripHtml(tagValue(block, "link")) || tagValue(block, "guid");
    const description = stripHtml(tagValue(block, "description"));
    const pubRaw = tagValue(block, "pubDate");
    const pubDate = pubRaw ? new Date(pubRaw) : null;
    const sourceTag = sourceFromItem(block);
    if (sourceTag.name) sourceName = sourceTag.name;

    if (!title || !link) continue;

    const host =
      hostFromUrl(sourceTag.url) ||
      hostFromUrl(link) ||
      (sourceName ? sourceName.toLowerCase().replace(/\s+/g, "") + ".com" : "news.google.com");

    const summary =
      description ||
      `Coverage from ${sourceName || sourceNameForHost(host)} on the South African / African screen industry.`;

    if (!looksRelevant(title, summary, host)) continue;

    out.push({
      id: articleId(link, title),
      title,
      summary: summary.slice(0, 600),
      url: link,
      sourceName: sourceName || sourceNameForHost(host),
      sourceHost: hostFromUrl(sourceTag.url) || hostFromUrl(link) || host,
      publishedLabel: formatPubLabel(pubDate),
      publishedAt: pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate.toISOString() : null,
      provider: "rss",
      kind: isHubUrl(link) ? "hub" : "article",
    });
  }

  return out;
}

async function collectFromRss(): Promise<IndustryNewsArticle[]> {
  const settled = await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      const xml = await fetchText(feed.url);
      if (!xml) return [] as IndustryNewsArticle[];
      return parseRssItems(xml);
    }),
  );
  return settled.flat();
}

async function collectFromWebSearch(): Promise<IndustryNewsArticle[]> {
  const out: IndustryNewsArticle[] = [];
  for (const query of WEB_FALLBACK_QUERIES) {
    try {
      const batch = await searchWeb(query, 8);
      for (const row of batch) {
        const url = (row.url || "").trim();
        const title = (row.title || "").trim();
        const summary = (row.snippet || "").trim();
        if (!url || !title) continue;
        const host = hostFromUrl(url);
        if (!looksRelevant(title, summary, host)) continue;
        out.push({
          id: articleId(url, title),
          title,
          summary: summary || "Open the source for the full report.",
          url,
          sourceName: sourceNameForHost(host),
          sourceHost: host || "unknown",
          publishedLabel: null,
          publishedAt: null,
          provider: row.source,
          kind: isHubUrl(url) ? "hub" : "article",
        });
      }
    } catch {
      /* next query */
    }
  }
  return out;
}

function curatedFallback(): IndustryNewsArticle[] {
  const items = [
    {
      title: "NFVF — funding & industry programmes",
      summary:
        "National Film and Video Foundation hub for funding windows, transformation programmes, and official SA film development updates.",
      url: "https://www.nfvf.co.za/",
      host: "nfvf.co.za",
    },
    {
      title: "Screen Africa — African screen news",
      summary:
        "Production, festival, and distribution coverage across the African screen industries, with strong South African reporting.",
      url: "https://www.screenafrica.com/",
      host: "screenafrica.com",
    },
    {
      title: "Bizcommunity — Media & Entertainment",
      summary:
        "South African media and entertainment business news spanning film, TV, advertising, and streaming.",
      url: "https://www.bizcommunity.com/Category/196/15.html",
      host: "bizcommunity.com",
    },
    {
      title: "News24 — Entertainment",
      summary: "South African entertainment desk covering film, TV, and celebrity culture.",
      url: "https://www.news24.com/life/entertainment",
      host: "news24.com",
    },
    {
      title: "IOL — Entertainment",
      summary: "Independent Online entertainment coverage including local film and TV stories.",
      url: "https://www.iol.co.za/entertainment",
      host: "iol.co.za",
    },
    {
      title: "Daily Maverick — Arts & Culture",
      summary: "In-depth South African arts and culture reporting, often including film and festivals.",
      url: "https://www.dailymaverick.co.za/section/maverick-life/",
      host: "dailymaverick.co.za",
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
    publishedAt: null,
    provider: "curated" as const,
    kind: "hub" as const,
  }));
}

function dedupeAndRank(articles: IndustryNewsArticle[], max: number): IndustryNewsArticle[] {
  const seen = new Set<string>();
  const ranked = [...articles].sort((a, b) => {
    const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    if (bt !== at) return bt - at;
    if (a.kind !== b.kind) return a.kind === "article" ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  const out: IndustryNewsArticle[] = [];
  for (const a of ranked) {
    const key = a.url.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
    const titleKey = a.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key) || seen.has(titleKey)) continue;
    seen.add(key);
    seen.add(titleKey);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
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

export async function getCreatorIndustryNews(opts?: {
  forceRefresh?: boolean;
}): Promise<IndustryNewsPayload> {
  const force = Boolean(opts?.forceRefresh);
  const now = Date.now();
  if (!force && cache && cache.expiresAt > now) {
    return { ...cache.payload, refreshed: false };
  }

  const [rssArticles, webArticles] = await Promise.all([
    collectFromRss().catch(() => [] as IndustryNewsArticle[]),
    collectFromWebSearch().catch(() => [] as IndustryNewsArticle[]),
  ]);

  let live = dedupeAndRank([...rssArticles, ...webArticles], MAX_ARTICLES);
  let providerNote: string | null = null;

  if (live.length < 6) {
    const hubs = curatedFallback();
    live = dedupeAndRank([...live, ...hubs], MAX_ARTICLES);
    if (rssArticles.length === 0 && webArticles.length === 0) {
      providerNote =
        "Live feeds were briefly unavailable — showing industry hubs. Tap refresh in a minute.";
    }
  }

  const payload: IndustryNewsPayload = {
    articles: live,
    sources: buildSources(live),
    fetchedAt: new Date().toISOString(),
    refreshed: true,
    staleAfterMinutes: STALE_AFTER_MINUTES,
    queryFocus: "South African film & screen industry",
    liveCount: live.filter((a) => a.provider !== "curated").length,
    providerNote,
  };

  cache = { payload, expiresAt: now + CACHE_TTL_MS };
  return payload;
}

/** Best-effort full-text extract for in-panel reading. */
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
  if (isHubUrl(url.toString()) || host === "news.google.com") {
    return {
      ok: false,
      error: "This link opens on the publisher’s site — use Open original to read the full piece.",
      sourceHost: host,
      sourceName: sourceNameForHost(host),
    };
  }

  try {
    const html = await fetchText(url.toString());
    if (!html) {
      return {
        ok: false,
        error: "Could not reach this publisher. Open the original link instead.",
        sourceHost: host,
        sourceName: sourceNameForHost(host),
      };
    }
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim();
    const text = htmlToReadableText(html);
    if (text.length < 160) {
      return {
        ok: false,
        error: "This publisher blocks in-app reading. Open the original for the full story.",
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
