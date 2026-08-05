/*
 * The user-agent parser against strings real visitors actually sent,
 * plus the browsers that impersonate one another — the cases where the
 * order the patterns are tried in is the whole of the correctness.
 *
 *   npx tsx scripts/check-user-agent.ts
 */

import { readFileSync } from "node:fs";

import {
  describeLanguage,
  describeUserAgent,
  parseUserAgent,
} from "../src/lib/user-agent";

interface Case {
  ua: string;
  browser: string;
}

const KNOWN: Case[] = [
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91",
    browser: "Edge",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    browser: "Chrome",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    browser: "Safari",
  },
  {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
    browser: "Chrome",
  },
  {
    ua: "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
    browser: "Samsung Internet",
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Whale/3.21.192.18 Safari/537.36",
    browser: "Whale",
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/122.0",
    browser: "Firefox",
  },
];

let failed = 0;

console.log("browsers that impersonate one another:");

for (const testCase of KNOWN) {
  const parsed = parseUserAgent(testCase.ua);
  const ok = parsed.browser === testCase.browser;

  if (!ok) {
    failed += 1;
  }

  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${String(describeUserAgent(testCase.ua)).padEnd(32)} ${parsed.deviceType}`,
  );
}

/*
 * Then whatever real visitors sent, dumped to /tmp/uas.json beforehand.
 * Skipped when it is not there, so the impersonation cases still run.
 */
let rows: { user_agent: string | null; browser_language: string | null }[] = [];

try {
  rows = JSON.parse(readFileSync("/tmp/uas.json", "utf8"));
} catch {
  console.log("\n(no recorded user agents to check)");
}

if (rows.length > 0) {
  console.log("\nstrings real visitors sent:");

  const seen = new Set<string>();

  for (const row of rows) {
    const key = `${row.user_agent}|${row.browser_language}`;

    if (!row.user_agent || seen.has(key)) {
      continue;
    }

    seen.add(key);

    const described = describeUserAgent(row.user_agent);

    if (!described) {
      failed += 1;
    }

    console.log(
      `  ${described ? "ok  " : "FAIL"} ${String(described).padEnd(32)} ${
        describeLanguage(row.browser_language) ?? "—"
      }`,
    );
  }
}

console.log(failed === 0 ? "\nall parsed" : `\n${failed} failed`);

process.exit(failed === 0 ? 0 : 1);
