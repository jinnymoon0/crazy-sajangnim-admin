"use client";

import { useCallback, useEffect, useState } from "react";

interface Row {
  label: string;
  value: number;
  secondary: number | null;
}

interface Panel {
  key: string;
  title: string;
  hint: string;
  rows: Row[];
  exploreUrl: string;
}

interface Payload {
  panels: Panel[];
  failed: { key: string; title: string; message: string }[];
  windowDays: number;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: Payload }
  | { kind: "unconfigured"; missing: string[] }
  | { kind: "error"; message: string };

/*
 * A bar the width of its share of the panel's largest value. Enough to
 * see the shape at a glance; anyone who needs the real chart follows
 * the link to PostHog.
 */
function Bar({ fraction }: { fraction: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
      <div
        className="h-full rounded-full bg-neutral-800"
        style={{ width: `${Math.max(2, Math.round(fraction * 100))}%` }}
      />
    </div>
  );
}

function PanelCard({ panel }: { panel: Panel }) {
  const max = panel.rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-neutral-900">{panel.title}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">{panel.hint}</p>
        </div>

        <a
          href={panel.exploreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-900 hover:text-white"
        >
          Explore ↗
        </a>
      </div>

      {panel.rows.length === 0 ? (
        <p className="mt-4 text-xs text-neutral-500">Nothing in this period.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {panel.rows.map((row) => (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span
                  className="min-w-0 truncate text-neutral-700"
                  title={row.label}
                >
                  {row.label}
                </span>

                <span className="shrink-0 tabular-nums font-semibold text-neutral-900">
                  {row.value.toLocaleString()}
                  {row.secondary !== null ? (
                    <span className="ml-1.5 text-xs font-normal text-neutral-400">
                      / {row.secondary.toLocaleString()} people
                    </span>
                  ) : null}
                </span>
              </div>

              <div className="mt-1">
                <Bar fraction={row.value / max} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function PostHogPanels() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });

    try {
      const response = await fetch("/api/posthog-analytics", {
        cache: "no-store",
      });

      const body = (await response.json()) as Payload & {
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

      setState({ kind: "ready", data: body });
    } catch {
      setState({
        kind: "error",
        message: "The admin could not reach its own API.",
      });
    }
  }, []);

  useEffect(() => {
    /* Deferred past the render tick, as the strict effect lint requires. */
    const timer = window.setTimeout(() => void load(), 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((card) => (
          <div
            key={card}
            className="h-56 animate-pulse rounded-2xl border border-neutral-200 bg-white"
          />
        ))}
      </div>
    );
  }

  if (state.kind === "unconfigured") {
    return (
      <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">PostHog is not configured.</p>

        <p className="mt-2">
          Set{" "}
          {state.missing.map((name, index) => (
            <span key={name}>
              {index > 0 ? ", " : ""}
              <code className="font-mono">{name}</code>
            </span>
          ))}{" "}
          in this project&rsquo;s environment.
        </p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-900">
        <p className="font-semibold">Could not load PostHog analytics.</p>
        <p className="mt-2">{state.message}</p>

        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold transition hover:bg-red-100"
        >
          Try again
        </button>
      </div>
    );
  }

  const { panels, failed, windowDays } = state.data;

  return (
    <>
      <p className="mt-1 text-sm text-neutral-500">
        From PostHog, the last {windowDays} days. Each panel opens in PostHog
        for the version you can slice.
      </p>

      {/*
        A panel that failed is named rather than hidden. Six independent
        queries; one erroring on a property that does not exist yet
        should not take the five that worked with it.
      */}
      {failed.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
          <p className="font-semibold">
            {failed.length} panel{failed.length === 1 ? "" : "s"} could not be
            loaded:
          </p>

          <ul className="mt-1 list-inside list-disc">
            {failed.map((f) => (
              <li key={f.key}>
                {f.title} — {f.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {panels.map((panel) => (
          <PanelCard key={panel.key} panel={panel} />
        ))}
      </div>
    </>
  );
}
