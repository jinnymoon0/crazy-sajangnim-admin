"use client";

import { useCallback, useEffect, useState } from "react";

interface Recording {
  id: string;
  distinctId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  clickCount: number | null;
  keypressCount: number | null;
  startUrl: string | null;
  available: boolean;
  personName: string | null;
  visitorId: string | null;
  playbackUrl: string;
}

interface Page {
  recordings: Recording[];
  nextOffset: number | null;
  hasMore: boolean;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; recordings: Recording[]; nextOffset: number | null }
  | { kind: "empty" }
  /* The variables are not set — a setup problem, not a fault. */
  | { kind: "unconfigured"; missing: string[] }
  | { kind: "error"; message: string };

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return "—";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);

  return `${minutes}m ${seconds % 60}s`;
}

export default function SessionReplayList({
  retentionDays,
}: {
  retentionDays: number;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setState({ kind: "loading" });
      }

      try {
        const response = await fetch(`/api/replays?offset=${offset}`, {
          cache: "no-store",
        });

        const body = (await response.json()) as Page & {
          error?: string;
          missing?: string[];
        };

        if (response.status === 503 && body.missing) {
          setState({ kind: "unconfigured", missing: body.missing });

          return;
        }

        if (!response.ok) {
          setState({
            kind: "error",
            message: body.error ?? `The request failed (${response.status}).`,
          });

          return;
        }

        setState((previous) => {
          const existing =
            append && previous.kind === "ready" ? previous.recordings : [];

          const recordings = [...existing, ...body.recordings];

          if (recordings.length === 0) {
            return { kind: "empty" };
          }

          return { kind: "ready", recordings, nextOffset: body.nextOffset };
        });
      } catch {
        setState({
          kind: "error",
          message: "The admin could not reach its own API.",
        });
      } finally {
        setIsLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    /*
     * Deferred past the render tick. The strict effect lint rejects a
     * state update started synchronously inside an effect, and the
     * blog's comment list in the shop defers the same way.
     */
    const timer = window.setTimeout(() => {
      void load(0, false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div className="mt-6 space-y-3">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="h-16 animate-pulse rounded-2xl border border-neutral-200 bg-white"
          />
        ))}
      </div>
    );
  }

  if (state.kind === "unconfigured") {
    return (
      <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">Session replay is not configured.</p>

        <p className="mt-2">
          Set{" "}
          {state.missing.map((name, index) => (
            <span key={name}>
              {index > 0 ? ", " : ""}
              <code className="font-mono">{name}</code>
            </span>
          ))}{" "}
          in this project&rsquo;s environment, then reload. The personal API
          key is read on the server only and must not use a{" "}
          <code className="font-mono">NEXT_PUBLIC_</code> prefix.
        </p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-900">
        <p className="font-semibold">Could not load recordings.</p>

        <p className="mt-2">{state.message}</p>

        <button
          type="button"
          onClick={() => void load(0, false)}
          className="mt-4 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold transition hover:bg-red-100"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
        <p className="font-semibold text-neutral-700">No recordings yet.</p>

        <p className="mt-2">
          Recordings appear a minute or two after someone browses the shop,
          and the free plan keeps them for {retentionDays} days — so this is
          also what an empty month looks like, not only a broken setup.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Length</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3">Landed on</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>

          <tbody>
            {state.recordings.map((recording) => (
              <tr
                key={recording.id}
                className="border-b border-neutral-100 last:border-0"
              >
                <td className="px-4 py-3 whitespace-nowrap text-neutral-700">
                  {formatDateTime(recording.startedAt)}
                </td>

                <td className="px-4 py-3">
                  <p className="text-neutral-700">
                    {recording.personName ?? "Not signed in"}
                  </p>

                  {/*
                    Our own visitor cookie, when the recording carried
                    it — this is what joins a replay to the visit rows
                    and page views already in Supabase.
                  */}
                  {recording.visitorId ? (
                    <p
                      className="font-mono text-xs text-neutral-400"
                      title={recording.visitorId}
                    >
                      cs_visitor {recording.visitorId.slice(0, 8)}
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-400">no visitor id</p>
                  )}
                </td>

                <td className="px-4 py-3 whitespace-nowrap tabular-nums text-neutral-700">
                  {formatDuration(recording.durationSeconds)}
                </td>

                <td className="px-4 py-3 whitespace-nowrap text-xs text-neutral-500">
                  {recording.clickCount ?? 0} clicks ·{" "}
                  {recording.keypressCount ?? 0} keys
                </td>

                <td className="px-4 py-3">
                  <p
                    className="max-w-64 truncate text-xs text-neutral-500"
                    title={recording.startUrl ?? ""}
                  >
                    {recording.startUrl ?? "—"}
                  </p>
                </td>

                <td className="px-4 py-3 text-right">
                  {recording.available ? (
                    <a
                      href={recording.playbackUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-900 hover:text-white"
                    >
                      Watch in PostHog ↗
                    </a>
                  ) : (
                    <span className="text-xs text-neutral-400">expired</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.nextOffset !== null ? (
        <button
          type="button"
          onClick={() => void load(state.nextOffset as number, true)}
          disabled={isLoadingMore}
          className="mt-4 rounded-full border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoadingMore ? "Loading..." : "Load more"}
        </button>
      ) : (
        <p className="mt-4 text-xs text-neutral-500">
          That is everything from the last {retentionDays} days.
        </p>
      )}
    </>
  );
}
