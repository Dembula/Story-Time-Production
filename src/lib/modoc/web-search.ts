import "server-only";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: "tavily" | "serper" | "duckduckgo";
};

const SEARCH_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchTavily(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return [];

  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: false,
    }),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (data.results ?? []).slice(0, maxResults).map((r) => ({
    title: r.title ?? "Result",
    url: r.url ?? "",
    snippet: (r.content ?? "").slice(0, 400),
    source: "tavily" as const,
  }));
}

async function searchSerper(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const key = process.env.SERPER_API_KEY?.trim();
  if (!key) return [];

  const res = await fetchWithTimeout("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": key,
    },
    body: JSON.stringify({ q: query, num: maxResults }),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (data.organic ?? []).slice(0, maxResults).map((r) => ({
    title: r.title ?? "Result",
    url: r.link ?? "",
    snippet: (r.snippet ?? "").slice(0, 400),
    source: "serper" as const,
  }));
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<WebSearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
  const res = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string } | { Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
  };

  const results: WebSearchResult[] = [];
  if (data.AbstractText) {
    results.push({
      title: data.Heading ?? "Summary",
      url: data.AbstractURL ?? "",
      snippet: data.AbstractText.slice(0, 500),
      source: "duckduckgo",
    });
  }

  for (const topic of data.RelatedTopics ?? []) {
    if (results.length >= maxResults) break;
    if ("Topics" in topic && Array.isArray(topic.Topics)) {
      for (const sub of topic.Topics) {
        if (results.length >= maxResults) break;
        if (sub.Text) {
          results.push({
            title: sub.Text.slice(0, 80),
            url: sub.FirstURL ?? "",
            snippet: sub.Text.slice(0, 400),
            source: "duckduckgo",
          });
        }
      }
    } else if ("Text" in topic && topic.Text) {
      results.push({
        title: topic.Text.slice(0, 80),
        url: topic.FirstURL ?? "",
        snippet: topic.Text.slice(0, 400),
        source: "duckduckgo",
      });
    }
  }

  return results.slice(0, maxResults);
}

/** Search the web using configured providers (Tavily → Serper → DuckDuckGo). */
export async function searchWeb(query: string, maxResults = 5): Promise<WebSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  if (process.env.VA_WEB_SEARCH_ENABLED === "false") {
    return [];
  }

  try {
    const tavily = await searchTavily(q, maxResults);
    if (tavily.length > 0) return tavily;
  } catch {
    /* try next provider */
  }

  try {
    const serper = await searchSerper(q, maxResults);
    if (serper.length > 0) return serper;
  } catch {
    /* try next provider */
  }

  try {
    return await searchDuckDuckGo(q, maxResults);
  } catch {
    return [];
  }
}

export function formatWebSearchForPrompt(results: WebSearchResult[], query: string): string {
  if (results.length === 0) {
    return `## Web search\nNo results retrieved for: "${query}". Answer from general knowledge and note that live web data was unavailable.`;
  }

  const lines = [
    `## Web search results (external — cite as web sources, not platform data)`,
    `Query: "${query}"`,
    "",
  ];
  results.forEach((r, i) => {
    lines.push(
      `${i + 1}. **${r.title}**`,
      r.url ? `   URL: ${r.url}` : "",
      `   ${r.snippet}`,
      `   (source: ${r.source})`,
      "",
    );
  });
  lines.push(
    "When using these results, tell the user information came from web search. Do not present web snippets as Story Time project facts.",
  );
  return lines.filter(Boolean).join("\n");
}

export function isWebSearchConfigured(): boolean {
  return (
    process.env.VA_WEB_SEARCH_ENABLED !== "false" &&
    (!!process.env.TAVILY_API_KEY?.trim() ||
      !!process.env.SERPER_API_KEY?.trim() ||
      true) /* DuckDuckGo fallback always available */
  );
}
