import Link from "next/link";

import AdminNav from "@/components/AdminNav";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

interface VisitRow {
  id: string;
  visitor_id: string;
  user_id: string | null;
  visit_date: string;
  first_seen_at: string;
  last_seen_at: string;
  page_views: number;
  ip_address: string | null;
  ip_country: string | null;
  ip_city: string | null;
  ip_region: string | null;
  referrer: string | null;
  landing_path: string | null;
  user_agent: string | null;
  device_platform: string | null;
  screen_size: string | null;
  timezone: string | null;
  browser_language: string | null;
  connection_type: string | null;
  cpu_cores: number | null;
  device_memory_gb: number | null;
  viewport_size: string | null;
  languages: string[] | null;
  max_touch_points: number | null;
  do_not_track: boolean | null;
  is_returning: boolean | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

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

interface Person {
  username: string | null;
  fullName: string | null;
  email: string | null;
}

async function getVisits(): Promise<{
  visits: VisitRow[];
  people: Map<string, Person>;
  /* Account per browser, so sessions from before they signed in are
     named too — the cookie is the same one they carried anonymously. */
  accountByVisitor: Map<string, string>;
  tableReady: boolean;
}> {
  const supabase = getSupabaseAdmin();

  const visits: VisitRow[] = [];

  // A response is capped at a thousand rows however large a limit is
  // asked for, so read it a page at a time.
  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;

    const { data, error } = await supabase
      .from("site_visits")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      if (error.code !== "42P01" && error.code !== "PGRST205") {
        console.error("Visit list failed:", error.message);
      }

      return {
        visits: [],
        people: new Map(),
        accountByVisitor: new Map(),
        tableReady: false,
      };
    }

    const rows = (data ?? []) as VisitRow[];

    visits.push(...rows);

    // Two thousand days of visits is more than the page needs to show.
    if (rows.length < PAGE_SIZE || visits.length >= 2000) {
      break;
    }
  }

  const userIds = Array.from(
    new Set(
      visits
        .map((visit) => visit.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const people = new Map<string, Person>();

  if (userIds.length > 0) {
    const { data } = await supabase
      .from("site_users")
      .select("id, username, full_name, email")
      .in("id", userIds);

    for (const row of (data ?? []) as {
      id: string;
      username: string | null;
      full_name: string | null;
      email: string | null;
    }[]) {
      people.set(row.id, {
        username: row.username,
        fullName: row.full_name,
        email: row.email,
      });
    }
  }

  /*
   * A browser that ever signs in names every visit it made, including
   * the ones from before — same cookie, same person.
   */
  const accountByVisitor = new Map<string, string>();

  for (const visit of visits) {
    if (visit.user_id && !accountByVisitor.has(visit.visitor_id)) {
      accountByVisitor.set(visit.visitor_id, visit.user_id);
    }
  }

  return { visits, people, accountByVisitor, tableReady: true };
}

export default async function VisitsPage() {
  const admin = await requireAdmin();
  const { visits, people, accountByVisitor, tableReady } = await getVisits();

  const named = visits.filter((visit) =>
    accountByVisitor.has(visit.visitor_id),
  ).length;
  const browsers = new Set(visits.map((visit) => visit.visitor_id)).size;
  const views = visits.reduce((sum, visit) => sum + (visit.page_views ?? 0), 0);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AdminNav adminEmail={admin.email} active="visits" />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <header>
          <h1 className="text-2xl font-bold">Visits</h1>

          <p className="mt-1 text-sm text-neutral-500">
            Everyone who opened the shop, signed in or not. One row per
            browser per day.
          </p>
        </header>

        {!tableReady ? (
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            The site_visits table does not exist yet. Run supabase/visits.sql
            from the shopping site repository.
          </p>
        ) : visits.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
            No visits recorded yet.
          </p>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              {[
                ["Visits", visits.length],
                ["Browsers", browsers],
                ["Page views", views],
                ["Named", named],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border border-neutral-200 bg-white p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {label}
                  </p>

                  <p className="mt-2 text-3xl font-bold">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Who</th>
                    <th className="px-4 py-3">Where from</th>
                    <th className="px-4 py-3">Came via</th>
                    <th className="px-4 py-3">Device</th>
                    <th className="px-4 py-3">Views</th>
                    <th className="px-4 py-3">Last seen</th>
                  </tr>
                </thead>

                <tbody>
                  {visits.map((visit) => (
                    <tr
                      key={visit.id}
                      className="border-b border-neutral-100 align-top last:border-b-0"
                    >
                      <td className="px-4 py-4">
                        {(() => {
                          const accountId = accountByVisitor.get(
                            visit.visitor_id,
                          );

                          const person = accountId
                            ? people.get(accountId)
                            : undefined;

                          if (!accountId || !person) {
                            /*
                             * Nothing in an anonymous request says who is
                             * holding the phone. Say so, rather than
                             * dressing up an address as a person.
                             */
                            return (
                              <span className="text-neutral-500">
                                no name — never signed in
                              </span>
                            );
                          }

                          return (
                            <>
                              <Link
                                href={`/users/${accountId}`}
                                className="font-semibold underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-950"
                              >
                                {person.fullName ??
                                  person.username ??
                                  "(no name set)"}
                              </Link>

                              {person.fullName && person.username ? (
                                <p className="text-[11px] text-neutral-500">
                                  {person.username}
                                </p>
                              ) : null}

                              {person.email ? (
                                <p className="break-all text-[11px] text-neutral-400">
                                  {person.email}
                                </p>
                              ) : null}

                              {!visit.user_id ? (
                                <p className="text-[11px] text-amber-700">
                                  signed in later
                                </p>
                              ) : null}
                            </>
                          );
                        })()}

                        <Link
                          href={`/visits/${visit.visitor_id}`}
                          className="block font-mono text-[11px] text-neutral-400 underline decoration-neutral-200 underline-offset-2 hover:text-neutral-700"
                        >
                          {visit.visitor_id.slice(0, 8)}
                        </Link>

                        {visit.is_returning ? (
                          <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                            returning
                          </span>
                        ) : null}
                      </td>

                      <td className="px-4 py-4 text-xs text-neutral-600">
                        <p className="font-mono">{visit.ip_address ?? "—"}</p>

                        <p className="text-neutral-500">
                          {[visit.ip_city, visit.ip_region, visit.ip_country]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-xs text-neutral-600">
                        <p className="max-w-56 truncate" title={visit.referrer ?? ""}>
                          {visit.referrer ?? "direct"}
                        </p>

                        <p className="max-w-56 truncate font-mono text-neutral-400">
                          {visit.landing_path ?? "—"}
                        </p>

                        {visit.utm_source || visit.utm_campaign ? (
                          <p className="mt-1 text-[11px] text-sky-700">
                            {[visit.utm_source, visit.utm_medium, visit.utm_campaign]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-4 text-xs text-neutral-600">
                        <p>
                          {visit.device_platform ?? "—"}
                          {visit.screen_size ? ` · screen ${visit.screen_size}` : ""}
                          {visit.viewport_size ? ` · window ${visit.viewport_size}` : ""}
                        </p>

                        <p className="text-neutral-400">
                          {[
                            visit.cpu_cores ? `${visit.cpu_cores} cores` : null,
                            visit.device_memory_gb
                              ? `${visit.device_memory_gb} GB`
                              : null,
                            visit.max_touch_points
                              ? `${visit.max_touch_points} touch`
                              : "no touch",
                            visit.do_not_track ? "do-not-track" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>

                        <p
                          className="max-w-56 truncate text-neutral-400"
                          title={visit.user_agent ?? ""}
                        >
                          {visit.user_agent ?? "—"}
                        </p>

                        <p className="text-neutral-400">
                          {[
                            visit.languages?.join(", ") ?? visit.browser_language,
                            visit.timezone,
                            visit.connection_type,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-center font-semibold">
                        {visit.page_views}
                      </td>

                      <td className="px-4 py-4 text-xs text-neutral-600">
                        {formatDateTime(visit.last_seen_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
