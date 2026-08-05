/*
 * Reading a user-agent string into the browser, engine, operating
 * system and device it describes.
 *
 * User-agent strings are deliberately misleading for historical
 * reasons: nearly every browser claims to be Mozilla, Chromium browsers
 * claim to be Chrome and Safari, and Edge claims to be all three. So
 * order matters — the most specific claim has to be tested before the
 * ones it impersonates, or everything reads as Chrome.
 */

export interface ParsedUserAgent {
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: "phone" | "tablet" | "desktop" | "bot" | null;
}

interface Rule {
  name: string;
  /* First capture group is the version, when there is one. */
  pattern: RegExp;
}

/*
 * Most specific first. Edge before Chrome before Safari, because Edge
 * names all three and Chrome names Safari.
 */
const BROWSERS: Rule[] = [
  { name: "Edge", pattern: /Edg(?:e|A|iOS)?\/([\d.]+)/ },
  { name: "Samsung Internet", pattern: /SamsungBrowser\/([\d.]+)/ },
  { name: "Opera", pattern: /(?:OPR|Opera)\/([\d.]+)/ },
  { name: "Whale", pattern: /Whale\/([\d.]+)/ },
  { name: "KAKAOTALK", pattern: /KAKAOTALK[ /]([\d.]+)/i },
  { name: "NAVER app", pattern: /NAVER\(inapp;[^)]*\)/ },
  { name: "Instagram", pattern: /Instagram ([\d.]+)/ },
  { name: "Facebook", pattern: /FBAV\/([\d.]+)/ },
  { name: "Firefox", pattern: /(?:Firefox|FxiOS)\/([\d.]+)/ },
  { name: "Chrome", pattern: /(?:Chrome|CriOS)\/([\d.]+)/ },
  { name: "Safari", pattern: /Version\/([\d.]+).*Safari/ },
];

/*
 * Not browsers at all: scripts, HTTP libraries and API tools. They turn
 * up in the visit log because anything that requests a page is recorded,
 * and reading as an unknown browser makes them look like people.
 */
const AUTOMATED: Rule[] = [
  { name: "Python urllib", pattern: /Python-urllib\/([\d.]+)/i },
  { name: "Python requests", pattern: /python-requests\/([\d.]+)/i },
  { name: "curl", pattern: /curl\/([\d.]+)/i },
  { name: "Wget", pattern: /Wget\/([\d.]+)/i },
  { name: "OkHttp", pattern: /okhttp\/([\d.]+)/i },
  { name: "Go HTTP client", pattern: /Go-http-client\/([\d.]+)/i },
  { name: "Java", pattern: /Java\/([\d.]+)/i },
  { name: "axios", pattern: /axios\/([\d.]+)/i },
  { name: "node-fetch", pattern: /node-fetch\/?([\d.]*)/i },
  { name: "Postman", pattern: /PostmanRuntime\/([\d.]+)/i },
  { name: "Apache HttpClient", pattern: /Apache-HttpClient\/([\d.]+)/i },
];

const OPERATING_SYSTEMS: Rule[] = [
  { name: "iOS", pattern: /(?:iPhone|iPad|iPod).*?OS ([\d_]+)/ },
  { name: "Android", pattern: /Android ([\d.]+)/ },
  { name: "macOS", pattern: /Mac OS X ([\d_.]+)/ },
  { name: "Windows", pattern: /Windows NT ([\d.]+)/ },
  { name: "Chrome OS", pattern: /CrOS \w+ ([\d.]+)/ },
  { name: "Linux", pattern: /(Linux)/ },
];

/*
 * Windows reports a kernel version rather than the name people know it
 * by, and has done since Vista.
 */
const WINDOWS_NAMES: Record<string, string> = {
  "10.0": "10/11",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
};

function firstMatch(value: string, rules: Rule[]): [string, string | null] | null {
  for (const rule of rules) {
    const match = rule.pattern.exec(value);

    if (match) {
      return [rule.name, match[1] ?? null];
    }
  }

  return null;
}

/* Only the parts people read: 121.0.6167.85 says no more than 121. */
function shortVersion(value: string | null, parts = 1): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/_/g, ".").split(".").slice(0, parts).join(".");
}

export function parseUserAgent(
  userAgent: string | null | undefined,
): ParsedUserAgent {
  const empty: ParsedUserAgent = {
    browser: null,
    browserVersion: null,
    os: null,
    osVersion: null,
    deviceType: null,
  };

  if (!userAgent) {
    return empty;
  }

  if (/bot|crawler|spider|crawling|headless|preview/i.test(userAgent)) {
    return { ...empty, browser: "Bot", deviceType: "bot" };
  }

  const automated = firstMatch(userAgent, AUTOMATED);

  if (automated) {
    return {
      ...empty,
      browser: automated[0],
      browserVersion: shortVersion(automated[1], 2),
      deviceType: "bot",
    };
  }

  const browser = firstMatch(userAgent, BROWSERS);
  const os = firstMatch(userAgent, OPERATING_SYSTEMS);

  let osName = os?.[0] ?? null;
  let osVersion = shortVersion(os?.[1] ?? null, 2);

  if (osName === "Windows") {
    osVersion = WINDOWS_NAMES[osVersion ?? ""] ?? osVersion;
  }

  if (osName === "Linux" || osVersion === "Linux") {
    osVersion = null;
    osName = "Linux";
  }

  /*
   * iPads have claimed to be desktop Macs since iPadOS 13, so a Mac
   * reporting a touchscreen is one.
   */
  const isTablet =
    /iPad/.test(userAgent) ||
    (/Android/.test(userAgent) && !/Mobile/.test(userAgent));

  const isPhone =
    /iPhone|iPod/.test(userAgent) ||
    (/Android/.test(userAgent) && /Mobile/.test(userAgent)) ||
    /Windows Phone/.test(userAgent);

  return {
    browser: browser?.[0] ?? null,
    browserVersion: shortVersion(browser?.[1] ?? null),
    os: osName,
    osVersion,
    deviceType: isPhone ? "phone" : isTablet ? "tablet" : "desktop",
  };
}

/* "Chrome 121 on macOS 14" — what to show in a single field. */
export function describeUserAgent(
  userAgent: string | null | undefined,
): string | null {
  const parsed = parseUserAgent(userAgent);

  if (!parsed.browser && !parsed.os) {
    return null;
  }

  const browser = [parsed.browser, parsed.browserVersion]
    .filter(Boolean)
    .join(" ");

  const os = [parsed.os, parsed.osVersion].filter(Boolean).join(" ");

  if (!browser) {
    return os || null;
  }

  return os ? `${browser} on ${os}` : browser;
}

/*
 * Language tags as sent by the browser, turned into names a person can
 * read: "ko-KR" -> "Korean (South Korea)".
 */
export function describeLanguage(tag: string | null | undefined): string | null {
  if (!tag) {
    return null;
  }

  const trimmed = tag.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const locale = new Intl.Locale(trimmed);

    const language = new Intl.DisplayNames(["en"], { type: "language" }).of(
      locale.language,
    );

    const region = locale.region
      ? new Intl.DisplayNames(["en"], { type: "region" }).of(locale.region)
      : null;

    if (!language) {
      return trimmed;
    }

    return region ? `${language} (${region})` : language;
  } catch {
    /* An unparseable tag is still worth showing as it arrived. */
    return trimmed;
  }
}
