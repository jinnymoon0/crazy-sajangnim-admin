import Link from "next/link";
import { notFound } from "next/navigation";

import AdminNav from "@/components/AdminNav";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  describeLanguage,
  parseUserAgent,
} from "@/lib/user-agent";

export const dynamic = "force-dynamic";

interface VisitRow {
  id: string;
  visit_date: string;
  first_seen_at: string;
  last_seen_at: string;
  page_views: number;
  is_returning: boolean | null;
  user_id: string | null;
  ip_address: string | null;
  ip_country: string | null;
  ip_city: string | null;
  ip_region: string | null;
  referrer: string | null;
  landing_path: string | null;
  user_agent: string | null;
  device_platform: string | null;
  screen_size: string | null;
  viewport_size: string | null;
  timezone: string | null;
  browser_language: string | null;
  languages: string[] | null;
  cpu_cores: number | null;
  device_memory_gb: number | null;
  connection_type: string | null;
  max_touch_points: number | null;
  do_not_track: boolean | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
}

interface PersonRow {
  username: string | null;
  full_name: string | null;
  email: string | null;
}

interface PageViewRow {
  id: string;
  path: string;
  referrer: string | null;
  market: string | null;
  gender: string | null;
  viewed_at: string;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function minutesBetween(from: string, to: string): string {
  const ms = new Date(to).getTime() - new Date(from).getTime();

  if (!Number.isFinite(ms) || ms < 0) {
    return "—";
  }

  const minutes = Math.round(ms / 60000);

  return minutes < 1 ? "under a minute" : `${minutes} min`;
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-neutral-400">{label}</dt>
      <dd className="min-w-0 break-words text-neutral-700">
        {value === null || value === undefined || value === ""
          ? "—"
          : String(value)}
      </dd>
    </div>
  );
}

export default async function VisitorPage({
  params,
}: {
  params: Promise<{ visitorId: string }>;
}) {
  const admin = await requireAdmin();
  const { visitorId } = await params;

  const supabase = getSupabaseAdmin();

  const [visitsResult, viewsResult] = await Promise.all([
    supabase
      .from("site_visits")
      .select("*")
      .eq("visitor_id", visitorId)
      .order("visit_date", { ascending: false }),

    supabase
      .from("site_page_views")
      .select("id, path, referrer, market, gender, viewed_at")
      .eq("visitor_id", visitorId)
      .order("viewed_at", { ascending: false })
      .limit(500),
  ]);

  const visits = (visitsResult.data ?? []) as VisitRow[];

  if (visits.length === 0) {
    notFound();
  }

  const views = (viewsResult.data ?? []) as PageViewRow[];

  const latest = visits[0];

  /*
   * The browser, OS and device the string describes, so the row reads
   * as something rather than as 200 characters of Mozilla/5.0.
   */
  const agent = parseUserAgent(latest.user_agent);

  const accountId = visits.find((visit) => visit.user_id)?.user_id ?? null;

  let person: PersonRow | null = null;

  if (accountId) {
    const { data } = await supabase
      .from("site_users")
      .select("username, full_name, email")
      .eq("id", accountId)
      .maybeSingle();

    person = (data as PersonRow | null) ?? null;
  }

  /*
   * Visits made before they signed in carry no account of their own,
   * but the cookie was the same, so they were the same person.
   */
  const anonymousBefore = visits.filter((visit) => !visit.user_id).length;

  const totalViews = visits.reduce(
    (sum, visit) => sum + (visit.page_views ?? 0),
    0,
  );

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AdminNav adminEmail={admin.email} active="visits" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/visits"
          className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-950"
        >
          ← All visits
        </Link>

        <header className="mt-4">
          <h1 className="font-mono text-2xl font-bold">
            {visitorId.slice(0, 8)}
          </h1>

          <p className="mt-1 text-sm text-neutral-500">
            {accountId && person ? (
              <>
                <Link
                  href={`/users/${accountId}`}
                  className="font-semibold underline underline-offset-2"
                >
                  {person.full_name ?? person.username ?? "(no name set)"}
                </Link>
                {person.username && person.full_name
                  ? ` (${person.username})`
                  : ""}
                {person.email ? ` · ${person.email}` : ""}
                {anonymousBefore > 0
                  ? ` · ${anonymousBefore} ${anonymousBefore === 1 ? "day" : "days"} before signing in`
                  : ""}
                {" · "}
              </>
            ) : (
              "No name — this browser has never signed in · "
            )}
            {visits.length} {visits.length === 1 ? "day" : "days"} ·{" "}
            {totalViews} page views
          </p>
        </header>

        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-bold">Most recent visit</h2>

          <dl className="mt-4 grid gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
            <Field label="Date" value={latest.visit_date} />
            <Field
              label="On site"
              value={minutesBetween(latest.first_seen_at, latest.last_seen_at)}
            />
            <Field label="IP" value={latest.ip_address} />
            <Field
              label="Location"
              value={
                [latest.ip_city, latest.ip_region, latest.ip_country]
                  .filter(Boolean)
                  .join(", ") || null
              }
            />
            <Field label="Referrer" value={latest.referrer ?? "direct"} />
            <Field label="Landed on" value={latest.landing_path} />
            <Field
              label="Browser"
              value={
                [agent.browser, agent.browserVersion].filter(Boolean).join(" ") ||
                null
              }
            />
            <Field
              label="Operating system"
              value={
                [agent.os, agent.osVersion].filter(Boolean).join(" ") || null
              }
            />
            <Field label="Device" value={agent.deviceType} />
            <Field label="Platform" value={latest.device_platform} />
            <Field label="Screen" value={latest.screen_size} />
            <Field label="Window" value={latest.viewport_size} />
            <Field label="Timezone" value={latest.timezone} />
            <Field
              label="Browser language"
              value={
                describeLanguage(latest.browser_language) ??
                latest.browser_language
              }
            />
            <Field
              label="All languages"
              value={
                latest.languages?.length
                  ? latest.languages
                      .map((tag) => describeLanguage(tag) ?? tag)
                      .join(", ")
                  : null
              }
            />
            <Field label="CPU cores" value={latest.cpu_cores} />
            <Field label="Memory" value={latest.device_memory_gb ? `${latest.device_memory_gb} GB` : null} />
            <Field label="Connection" value={latest.connection_type} />
            <Field label="Touch points" value={latest.max_touch_points} />
            <Field
              label="Do not track"
              value={latest.do_not_track ? "yes" : "not set"}
            />
            <Field label="Campaign source" value={latest.utm_source} />
            <Field label="Campaign medium" value={latest.utm_medium} />
            <Field label="Campaign name" value={latest.utm_campaign} />
            <Field label="Campaign term" value={latest.utm_term} />
            <Field label="Campaign content" value={latest.utm_content} />
          </dl>

          <p
            className="mt-4 break-words border-t border-neutral-100 pt-3 text-xs text-neutral-500"
            title={latest.user_agent ?? ""}
          >
            {latest.user_agent ?? "—"}
          </p>
        </section>

        <h2 className="mt-8 text-sm font-bold">
          What they opened
          {views.length >= 500 ? " (most recent 500)" : ""}
        </h2>

        {views.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
            No page views recorded for this browser yet. Only visits from
            after page-level recording was added will appear here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
            {views.map((view) => (
              <li
                key={view.id}
                className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3 text-xs"
              >
                <span className="font-mono text-neutral-700">{view.path}</span>

                <span className="flex items-center gap-3 text-neutral-500">
                  {view.market || view.gender ? (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-semibold">
                      {[view.market, view.gender].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}

                  {formatDateTime(view.viewed_at)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-8 text-sm font-bold">Every day they came</h2>

        <div className="mt-3 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Views</th>
                <th className="px-4 py-3">On site</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Came via</th>
              </tr>
            </thead>

            <tbody>
              {visits.map((visit) => (
                <tr
                  key={visit.id}
                  className="border-b border-neutral-100 last:border-b-0"
                >
                  <td className="px-4 py-3">{visit.visit_date}</td>
                  <td className="px-4 py-3">{visit.page_views}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {minutesBetween(visit.first_seen_at, visit.last_seen_at)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-600">
                    {visit.ip_address ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {visit.referrer ?? "direct"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
