/**
 * Human-readable labels for admin ops / live activity surfaces.
 */

const PATH_LABELS: Array<{ test: RegExp | string; label: string }> = [
  { test: /^\/$/, label: "Homepage (marketing landing)" },
  { test: /^\/browse\/?$/, label: "Browse catalogue home" },
  { test: /^\/browse\/content\//, label: "Watching a title detail page" },
  { test: /^\/browse\/search/, label: "Searching the catalogue" },
  { test: /^\/browse\/account/, label: "Viewer account settings" },
  { test: /^\/profiles/, label: "Choosing a viewer profile" },
  { test: /^\/onboarding/, label: "Viewer onboarding" },
  { test: /^\/auth\/creator/, label: "Creator sign-in / sign-up" },
  { test: /^\/auth\/admin/, label: "Admin sign-in" },
  { test: /^\/auth/, label: "Sign-in / sign-up" },
  { test: /^\/admin\/?$/, label: "Admin dashboard overview" },
  { test: /^\/admin\/activity/, label: "Admin activity log" },
  { test: /^\/admin\/users/, label: "Admin user directory" },
  { test: /^\/admin\/content/, label: "Admin content catalogue" },
  { test: /^\/admin\/creators/, label: "Admin creators" },
  { test: /^\/admin\/payments/, label: "Admin payments" },
  { test: /^\/admin\/revenue/, label: "Admin revenue" },
  { test: /^\/admin\/originals/, label: "Admin Originals review" },
  { test: /^\/admin\/ai/, label: "Admin AI console" },
  { test: /^\/admin/, label: "Admin area" },
  { test: /^\/creator\/command-center/, label: "Creator command centre" },
  { test: /^\/creator\/dashboard/, label: "Creator My Projects" },
  { test: /^\/creator\/network/, label: "Creator Network" },
  { test: /^\/creator\/catalogue/, label: "Creator catalogue upload" },
  { test: /^\/creator\/pre/, label: "Creator pre-production tools" },
  { test: /^\/creator\/projects\/[^/]+\/pre-production/, label: "Creator pre-production workspace" },
  { test: /^\/creator\/projects\/[^/]+\/production/, label: "Creator production workspace" },
  { test: /^\/creator\/projects/, label: "Creator project workspace" },
  { test: /^\/creator\/join/, label: "Accepting a project invite" },
  { test: /^\/creator/, label: "Creator portal" },
  { test: /^\/music-creator/, label: "Music creator portal" },
  { test: /^\/watch/, label: "Watching / playback" },
  { test: /^\/legal/, label: "Legal / policy page" },
  { test: /^\/about/, label: "About Us" },
  { test: /^\/wallet/, label: "Wallet" },
];

export function humanizeAdminPath(path: string | null | undefined): string {
  const raw = (path ?? "/").trim() || "/";
  const bare = raw.split("?")[0] || "/";
  for (const entry of PATH_LABELS) {
    if (typeof entry.test === "string") {
      if (bare === entry.test || bare.startsWith(entry.test)) return entry.label;
    } else if (entry.test.test(bare)) {
      return entry.label;
    }
  }
  // Soft fallback: turn /foo/bar into "Foo → Bar"
  const parts = bare.split("/").filter(Boolean);
  if (parts.length === 0) return "Homepage";
  return parts
    .map((p) =>
      p
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .join(" → ");
}

export function humanizeUserRole(role: string | null | undefined): string {
  if (!role) return "Guest visitor";
  const map: Record<string, string> = {
    ADMIN: "Admin",
    SUBSCRIBER: "Viewer",
    CONTENT_CREATOR: "Content creator",
    MUSIC_CREATOR: "Music creator",
    EQUIPMENT_COMPANY: "Equipment company",
    LOCATION_OWNER: "Location owner",
    CREW_TEAM: "Crew team",
    CASTING_AGENCY: "Casting agency",
    CATERING_COMPANY: "Catering company",
    FUNDER: "Funder",
  };
  return map[role] ?? role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function humanizeDeviceLabel(props: {
  mobile?: boolean | null;
  isIOS?: boolean | null;
  browser?: string | null;
  family?: string | null;
}): string {
  const bits: string[] = [];
  if (props.isIOS) bits.push("iPhone / iPad");
  else if (props.mobile) bits.push("Mobile");
  else if (props.family === "tv") bits.push("TV");
  else bits.push("Desktop / laptop");
  if (props.browser) bits.push(props.browser);
  return bits.join(" · ");
}

export type PlainErrorCopy = {
  title: string;
  summary: string;
  severity: "info" | "warning" | "critical";
};

/** Turn raw JS / React production errors into plain English for admins. */
export function humanizeClientErrorMessage(raw: string | null | undefined): PlainErrorCopy {
  const message = (raw ?? "").trim();
  const lower = message.toLowerCase();

  if (!message) {
    return {
      title: "Unknown page glitch",
      summary: "Something went wrong in the browser, but no details were recorded.",
      severity: "warning",
    };
  }

  if (/minified react error #418/i.test(message) || /hydration failed/i.test(message)) {
    return {
      title: "Page display mismatch",
      summary:
        "The mobile browser briefly rewrote part of the page (often a phone number or date) before it finished loading. Visitors usually recover automatically; it is noisy but rarely blocks the site.",
      severity: "info",
    };
  }

  if (/minified react error #423/i.test(message) || /minified react error #425/i.test(message)) {
    return {
      title: "Page failed to finish loading",
      summary:
        "React could not finish attaching the interactive page. Often caused by a slow network or a browser extension.",
      severity: "warning",
    };
  }

  if (/script error\.?/i.test(message)) {
    return {
      title: "Blocked third-party script",
      summary:
        "A script from another site failed, and the browser hid the details (common with ads, analytics, or privacy extensions).",
      severity: "info",
    };
  }

  if (/load failed|failed to fetch|networkerror|network request failed/i.test(message)) {
    return {
      title: "Connection interrupted",
      summary:
        "The browser could not finish loading data — usually a dropped mobile connection, the tab being backgrounded, or a timeout.",
      severity: "warning",
    };
  }

  if (/chunkloaderror|loading chunk|dynamically imported module/i.test(message)) {
    return {
      title: "App update interrupted download",
      summary:
        "A page piece failed to download (often after a deploy). Asking the visitor to refresh usually clears it.",
      severity: "warning",
    };
  }

  if (/out of memory|oom|allocation failed/i.test(message)) {
    return {
      title: "Device ran out of memory",
      summary: "The phone or browser ran low on memory and closed or stalled the page.",
      severity: "critical",
    };
  }

  if (/unhandledrejection/i.test(lower)) {
    return {
      title: "Background task failed",
      summary: "Something running in the background rejected without being handled cleanly.",
      severity: "warning",
    };
  }

  // Soft trim of technical prefixes for display.
  const cleaned = message
    .replace(/^Error:\s*/i, "")
    .replace(/visit https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  return {
    title: "Browser reported an error",
    summary: cleaned || "A client-side error was reported without a clear explanation.",
    severity: "warning",
  };
}

export function humanizeEventName(name: string | null | undefined): string {
  switch (name) {
    case "client_error":
      return "Page error";
    case "web_crash":
      return "App crash";
    case "page_view":
    case "route_view":
      return "Opened a page";
    case "heartbeat":
      return "Still on the page";
    default:
      return (name ?? "Event").replace(/_/g, " ");
  }
}
