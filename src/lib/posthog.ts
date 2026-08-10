/*
 * Reading session recordings out of PostHog.
 *
 * The first line is the important one. A personal API key can read and
 * write everything in the project, so it must never be bundled into a
 * page that a browser downloads. `server-only` turns that from a
 * convention into a build error: importing this file from a client
 * component fails the build rather than shipping the key.
 *
 * The key is deliberately not named with a NEXT_PUBLIC_ prefix either,
 * because that prefix is precisely the instruction to inline a value
 * into the client bundle.
 */
import "server-only";

export interface ReplayConfig {
  projectId: string;
  personalApiKey: string;
  /* Where a human goes to watch — app.posthog.com, not the ingest host. */
  appHost: string;
}

export type ConfigResult =
  | { ok: true; config: ReplayConfig }
  | { ok: false; missing: string[] };

/*
 * Which variables are absent, rather than a bare "not configured". The
 * admin shows this, and "POSTHOG_PROJECT_ID is missing" is a sentence
 * someone can act on.
 */
export function readReplayConfig(): ConfigResult {
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const appHost = process.env.POSTHOG_APP_HOST?.trim();

  const missing = [
    !projectId && "POSTHOG_PROJECT_ID",
    !personalApiKey && "POSTHOG_PERSONAL_API_KEY",
    !appHost && "POSTHOG_APP_HOST",
  ].filter((name): name is string => Boolean(name));

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    config: {
      projectId: projectId as string,
      personalApiKey: personalApiKey as string,
      appHost: (appHost as string).replace(/\/+$/, ""),
    },
  };
}

export interface Recording {
  id: string;
  distinctId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  clickCount: number | null;
  keypressCount: number | null;
  startUrl: string | null;
  /* Whether PostHog still holds the events needed to play it back. */
  available: boolean;
  personName: string | null;
  /* Our own visitor cookie, when the recording carried it. */
  visitorId: string | null;
  playbackUrl: string;
}

export interface RecordingPage {
  recordings: Recording[];
  /* Opaque cursor for the next page, or null at the end. */
  nextOffset: number | null;
  hasMore: boolean;
}

export class ReplayApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ReplayApiError";
  }
}

/*
 * The free plan keeps recordings for a month. Asking for older ones
 * returns nothing and looks like a fault, so the window is stated here
 * and shown in the admin — an empty page then reads as "nothing in the
 * last 30 days" rather than "this is broken".
 */
export const RETENTION_DAYS = 30;

export const PAGE_SIZE = 20;

interface PostHogRecording {
  id?: string;
  distinct_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  recording_duration?: number | null;
  click_count?: number | null;
  keypress_count?: number | null;
  start_url?: string | null;
  /* PostHog's own name for "the events are still stored". */
  storage?: string | null;
  person?: {
    name?: string | null;
    distinct_ids?: string[];
    properties?: Record<string, unknown> | null;
  } | null;
}

function toRecording(raw: PostHogRecording, appHost: string, projectId: string): Recording {
  const id = raw.id ?? "";

  const properties = raw.person?.properties ?? {};

  const visitorId =
    typeof properties.cs_visitor_id === "string"
      ? properties.cs_visitor_id
      : null;

  return {
    id,
    distinctId: raw.distinct_id ?? null,
    startedAt: raw.start_time ?? null,
    endedAt: raw.end_time ?? null,
    durationSeconds:
      typeof raw.recording_duration === "number"
        ? Math.round(raw.recording_duration)
        : null,
    clickCount: raw.click_count ?? null,
    keypressCount: raw.keypress_count ?? null,
    startUrl: raw.start_url ?? null,
    /*
     * Anything other than "object_storage_lts" expiring is still
     * playable; only an explicitly absent recording is not.
     */
    available: raw.storage !== "expired",
    personName: raw.person?.name ?? null,
    visitorId,
    /*
     * Playback stays in PostHog. Embedding a player would mean handing
     * the browser something that can read the project, and PostHog's
     * own viewer is better than anything worth rebuilding here.
     */
    playbackUrl: `${appHost}/project/${projectId}/replay/${id}`,
  };
}

export async function fetchRecordings(
  config: ReplayConfig,
  options: { offset?: number } = {},
): Promise<RecordingPage> {
  const offset = Math.max(0, options.offset ?? 0);

  const url = new URL(
    `/api/projects/${config.projectId}/session_recordings`,
    config.appHost,
  );

  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));

  /* Newest first, and never older than the plan keeps. */
  const since = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  url.searchParams.set("date_from", since);

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.personalApiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new ReplayApiError(
      error instanceof Error && error.name === "TimeoutError"
        ? "PostHog did not answer in time."
        : "PostHog could not be reached.",
      504,
    );
  }

  if (!response.ok) {
    /*
     * Said in terms of what to do about it. A 401 here is the personal
     * API key, and saying so saves the reader checking the project id.
     */
    const explanation =
      response.status === 401 || response.status === 403
        ? "PostHog refused the personal API key. Check POSTHOG_PERSONAL_API_KEY and that it has session recording read access."
        : response.status === 404
          ? "PostHog has no such project. Check POSTHOG_PROJECT_ID."
          : `PostHog answered ${response.status}.`;

    throw new ReplayApiError(explanation, response.status);
  }

  const body = (await response.json()) as {
    results?: PostHogRecording[];
    has_next?: boolean;
  };

  const results = body.results ?? [];

  const hasMore = Boolean(body.has_next) || results.length === PAGE_SIZE;

  return {
    recordings: results.map((raw) =>
      toRecording(raw, config.appHost, config.projectId),
    ),
    nextOffset: hasMore ? offset + PAGE_SIZE : null,
    hasMore,
  };
}

/* ------------------------------------------------------------------ *
 * Analytics, read with HogQL.
 *
 * PostHog's own dashboards are better than anything worth rebuilding,
 * so this is not an attempt to replace them. It answers the handful of
 * questions worth having next to the Supabase numbers already on this
 * page, without a second tab and a second login — and every panel links
 * out to PostHog for the version you can slice.
 * ------------------------------------------------------------------ */

export interface QueryRow {
  label: string;
  value: number;
  secondary?: number | null;
}

export interface Panel {
  key: string;
  title: string;
  hint: string;
  rows: QueryRow[];
  /* Where to see this properly. */
  exploreUrl: string;
}

async function runHogQL(
  config: ReplayConfig,
  query: string,
): Promise<unknown[][]> {
  let response: Response;

  try {
    response = await fetch(
      new URL(`/api/projects/${config.projectId}/query/`, config.appHost),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.personalApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      },
    );
  } catch (error) {
    throw new ReplayApiError(
      error instanceof Error && error.name === "TimeoutError"
        ? "PostHog did not answer in time."
        : "PostHog could not be reached.",
      504,
    );
  }

  if (!response.ok) {
    throw new ReplayApiError(
      response.status === 401 || response.status === 403
        ? "PostHog refused the personal API key. It needs query access as well as session recording read."
        : `PostHog answered ${response.status}.`,
      response.status,
    );
  }

  const body = (await response.json()) as { results?: unknown[][] };

  return body.results ?? [];
}

/*
 * The window every panel uses. Matches the replay retention so the two
 * halves of the page describe the same period.
 */
const WINDOW_DAYS = RETENTION_DAYS;

interface PanelSpec {
  key: string;
  title: string;
  hint: string;
  query: string;
  /* PostHog page to open for the full version. */
  explore: string;
}

const PANELS: PanelSpec[] = [
  {
    key: "daily",
    title: "Daily activity",
    hint: "page views, and the people behind them",
    explore: "web-analytics",
    query: `
      SELECT toString(toDate(timestamp)) AS day,
             count() AS views,
             count(DISTINCT person_id) AS people
      FROM events
      WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY
      GROUP BY day ORDER BY day DESC LIMIT 30`,
  },
  {
    key: "events",
    title: "What people did",
    hint: "every event, most frequent first",
    explore: "activity/explore",
    query: `
      SELECT event, count() AS c
      FROM events
      WHERE timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY
      GROUP BY event ORDER BY c DESC LIMIT 20`,
  },
  {
    key: "pages",
    title: "Most viewed pages",
    hint: "by path",
    explore: "web-analytics",
    query: `
      SELECT properties.$pathname AS path, count() AS c
      FROM events
      WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY
      GROUP BY path ORDER BY c DESC LIMIT 15`,
  },
  {
    key: "referrers",
    title: "Where people came from",
    hint: "referring domain",
    explore: "web-analytics",
    query: `
      SELECT properties.$referring_domain AS source, count() AS c
      FROM events
      WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY
      GROUP BY source ORDER BY c DESC LIMIT 15`,
  },
  {
    key: "browsers",
    title: "Browsers",
    hint: "as reported by the browser itself",
    explore: "web-analytics",
    query: `
      SELECT concat(properties.$browser, ' ', toString(properties.$browser_version)) AS browser,
             count(DISTINCT person_id) AS people
      FROM events
      WHERE timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY
      GROUP BY browser ORDER BY people DESC LIMIT 12`,
  },
  {
    key: "countries",
    title: "Countries",
    hint: "from the address, so a rough guide",
    explore: "web-analytics",
    query: `
      SELECT properties.$geoip_country_name AS country, count(DISTINCT person_id) AS people
      FROM events
      WHERE timestamp > now() - INTERVAL ${WINDOW_DAYS} DAY
      GROUP BY country ORDER BY people DESC LIMIT 12`,
  },
];

/*
 * Each panel is fetched independently and a failing one does not take
 * the page with it: a query that errors on one property should not hide
 * the five that worked.
 */
export async function fetchPanels(config: ReplayConfig): Promise<{
  panels: Panel[];
  failed: { key: string; title: string; message: string }[];
  windowDays: number;
}> {
  const settled = await Promise.allSettled(
    PANELS.map(async (spec) => {
      const rows = await runHogQL(config, spec.query);

      return {
        key: spec.key,
        title: spec.title,
        hint: spec.hint,
        exploreUrl: `${config.appHost}/project/${config.projectId}/${spec.explore}`,
        rows: rows
          .filter((row) => Array.isArray(row) && row.length >= 2)
          .map((row) => ({
            label:
              row[0] === null || row[0] === undefined || row[0] === ""
                ? "(not set)"
                : String(row[0]),
            value: Number(row[1]) || 0,
            secondary: row.length > 2 ? Number(row[2]) || 0 : null,
          })),
      } satisfies Panel;
    }),
  );

  const panels: Panel[] = [];
  const failed: { key: string; title: string; message: string }[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      panels.push(result.value);
    } else {
      failed.push({
        key: PANELS[index].key,
        title: PANELS[index].title,
        message:
          result.reason instanceof Error
            ? result.reason.message
            : "the query failed",
      });
    }
  });

  return { panels, failed, windowDays: WINDOW_DAYS };
}

