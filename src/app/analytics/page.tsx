import AdminNav from "@/components/AdminNav";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/*
 * What the site is doing, as opposed to what is in it.
 *
 * Visits already has who arrived and what they opened. This is the rest
 * of the question: what they searched for, whether they left for a
 * retailer — which is the only moment the site is worth anything to
 * anyone — how long the catalog took, and what broke.
 */

const WINDOW_DAYS = 30;

interface EventRow {
  kind: string;
  visitor_id: string | null;
  user_id: string | null;
  market: string | null;
  gender: string | null;
  metadata: Record<string, unknown> | null;
  duration_ms: number | null;
  created_at: string;
}

interface VisitRow {
  visitor_id: string | null;
  user_id: string | null;
  is_returning: boolean | null;
  visit_date: string;
}

function since(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/*
 * The middle and the tail. An average hides the shape of a latency
 * distribution completely: a route answering in 200ms for nine people
 * and 30s for the tenth averages to something nobody experienced.
 */
function percentile(values: number[], p: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );

  return sorted[index];
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-neutral-900">{value}</p>

      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

function Table({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; count: number }[];
  empty: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold">{title}</h2>

      {rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
          {empty}
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.label}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="px-4 py-3 text-neutral-700">{row.label}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {row.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function tally(
  rows: EventRow[],
  read: (row: EventRow) => string | null | undefined,
  limit = 12,
): { label: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const label = read(row);

    if (!label) {
      continue;
    }

    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export default async function AnalyticsPage() {
  const admin = await requireAdmin();

  const supabase = getSupabaseAdmin();

  const [eventsResult, visitsResult] = await Promise.all([
    supabase
      .from("site_events")
      .select(
        "kind, visitor_id, user_id, market, gender, metadata, duration_ms, created_at",
      )
      .gte("created_at", since(WINDOW_DAYS))
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("site_visits")
      .select("visitor_id, user_id, is_returning, visit_date")
      .gte("visit_date", since(WINDOW_DAYS).slice(0, 10))
      .limit(5000),
  ]);

  /*
   * The events table is added by a migration, so a deployment that has
   * not run it yet should say so rather than showing a page of zeroes
   * that reads as "nobody used the site".
   */
  const eventsMissing =
    eventsResult.error?.code === "42P01" ||
    eventsResult.error?.code === "PGRST205";

  const events = (eventsResult.data ?? []) as EventRow[];
  const visits = (visitsResult.data ?? []) as VisitRow[];

  const searches = events.filter((row) => row.kind === "search");
  const clicks = events.filter((row) => row.kind === "retailer_click");
  const failures = events.filter((row) => row.kind === "failure");

  const latencies = events
    .filter((row) => row.kind === "latency" && row.duration_ms !== null)
    .map((row) => row.duration_ms as number);

  const visitors = new Set(
    visits.map((visit) => visit.visitor_id).filter(Boolean),
  );

  const returning = new Set(
    visits
      .filter((visit) => visit.is_returning)
      .map((visit) => visit.visitor_id)
      .filter(Boolean),
  );

  const signedIn = new Set(
    visits.map((visit) => visit.user_id).filter(Boolean),
  );

  /* Of the people who searched, how many went on to a retailer. */
  const searchers = new Set(
    searches.map((row) => row.visitor_id).filter(Boolean),
  );

  const clickers = new Set(clicks.map((row) => row.visitor_id).filter(Boolean));

  const converting = [...clickers].filter((id) =>
    searchers.has(id as string),
  ).length;

  return (
    <div className="min-h-screen bg-neutral-50">
      <AdminNav active="analytics" adminEmail={admin.email} />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <header>
          <h1 className="text-2xl font-bold">Analytics</h1>

          <p className="mt-1 text-sm text-neutral-500">
            The last {WINDOW_DAYS} days.
          </p>
        </header>

        {eventsMissing ? (
          <p className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            Events are not being recorded yet. Run{" "}
            <code className="font-mono">supabase/site-events.sql</code> in the
            shop project to start collecting searches, retailer clicks,
            latency and failures. Visitor numbers below are unaffected.
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="Visitors"
            value={String(visitors.size)}
            hint={`${signedIn.size} signed in`}
          />
          <Tile
            label="Returning"
            value={String(returning.size)}
            hint={
              visitors.size > 0
                ? `${Math.round((returning.size / visitors.size) * 100)}% came back`
                : undefined
            }
          />
          <Tile
            label="Searches"
            value={String(searches.length)}
            hint={`${searchers.size} people`}
          />
          <Tile
            label="Retailer clicks"
            value={String(clicks.length)}
            hint={
              searchers.size > 0
                ? `${converting} of ${searchers.size} searchers left for a shop`
                : undefined
            }
          />
          <Tile
            label="Catalog p50"
            value={
              percentile(latencies, 50) === null
                ? "—"
                : `${percentile(latencies, 50)}ms`
            }
            hint="typical"
          />
          <Tile
            label="Catalog p95"
            value={
              percentile(latencies, 95) === null
                ? "—"
                : `${percentile(latencies, 95)}ms`
            }
            hint="the slow tail"
          />
          <Tile
            label="Failures"
            value={String(failures.length)}
            hint={
              latencies.length + failures.length > 0
                ? `${((failures.length / (latencies.length + failures.length)) * 100).toFixed(1)}% of catalog reads`
                : undefined
            }
          />
          <Tile
            label="Events recorded"
            value={String(events.length)}
            hint={events.length >= 5000 ? "capped at 5,000" : undefined}
          />
        </div>

        <Table
          title="Retailers people actually left for"
          rows={tally(clicks, (row) => row.metadata?.retailer as string)}
          empty="No retailer clicks recorded yet."
        />

        <Table
          title="Brands clicked through"
          rows={tally(clicks, (row) => row.metadata?.brand as string)}
          empty="No retailer clicks recorded yet."
        />

        <Table
          title="What people filtered for"
          rows={tally(searches, (row) => {
            const brands = (row.metadata?.brands as string) || "(no brand)";
            const category = (row.metadata?.category as string) || "all";

            return `${brands} · ${category}`;
          })}
          empty="No searches recorded yet."
        />

        <Table
          title="Storefront searched"
          rows={tally(searches, (row) =>
            row.market ? `${row.market} · ${row.gender ?? "—"}` : null,
          )}
          empty="No searches recorded yet."
        />

        <Table
          title="What failed"
          rows={tally(
            failures,
            (row) =>
              `${row.metadata?.operation ?? "unknown"} — ${row.metadata?.message ?? "no detail"}`,
          )}
          empty="Nothing has failed in this period."
        />
      </main>
    </div>
  );
}
