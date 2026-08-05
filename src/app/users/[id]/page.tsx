import Link from "next/link";
import { notFound } from "next/navigation";

import AdminNav from "@/components/AdminNav";
import UserActions from "@/components/UserActions";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type UserDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

interface SiteUserRow {
  id: string;
  username: string | null;
  email: string | null;
  full_name: string | null;
  given_name: string | null;
  family_name: string | null;
  avatar_url: string | null;
  email_verified: boolean | null;
  google_sub: string | null;
  google_locale: string | null;
  google_hosted_domain: string | null;
  browser_language: string | null;
  browser_languages: string[] | null;
  timezone: string | null;
  country_code: string | null;
  last_ip: string | null;
  ip_city: string | null;
  ip_region: string | null;
  user_agent: string | null;
  device_platform: string | null;
  screen_size: string | null;
  cpu_cores: number | null;
  device_memory_gb: number | null;
  connection_type: string | null;
  referrer: string | null;
  first_login_at: string | null;
  last_login_at: string | null;
  login_count: number | null;
  metadata_updated_at: string | null;
  created_at: string;
}

interface PostRow {
  id: string;
  title: string;
  content: string;
  image_urls: string[] | null;
  created_at: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  content: string;
  created_at: string;
}

interface LikeRow {
  id: string;
  post_id: string;
  created_at: string;
}

interface VisitRow {
  id: string;
  visit_date: string;
  first_seen_at: string;
  last_seen_at: string;
  page_views: number;
  ip_address: string | null;
  ip_country: string | null;
  ip_city: string | null;
  ip_region: string | null;
  device_platform: string | null;
  screen_size: string | null;
  user_agent: string | null;
  referrer: string | null;
}

/*
 * How long they stayed. The shop pings while a page is open and once
 * more on the way out, so this is time present rather than the gap
 * between the first and last page they opened.
 */
function stayLength(from: string, to: string): string {
  const ms = new Date(to).getTime() - new Date(from).getTime();

  if (!Number.isFinite(ms) || ms < 0) {
    return "—";
  }

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return minutes < 60
    ? `${minutes}m ${seconds}s`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : String(value);

  return (
    <div className="border-b border-neutral-100 py-2.5 last:border-b-0">
      <dt className="text-xs uppercase tracking-wide text-neutral-400">
        {label}
      </dt>

      <dd
        className={`mt-1 break-words text-sm text-neutral-800 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {display}
      </dd>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-bold">{title}</h2>

      <dl>{children}</dl>
    </section>
  );
}

export default async function UserDetailPage({
  params,
}: UserDetailPageProps) {
  const admin = await requireAdmin();
  const { id } = await params;

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("site_users")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const user = data as SiteUserRow;

  /*
   * Matched on the account, with the username as a fallback for writing
   * from before the id was recorded. Matching on the name alone lost
   * everything a person wrote before they renamed themselves.
   */
  const byAccount = `user_id.eq.${user.id}${
    user.username ? `,author_name.eq.${user.username}` : ""
  }`;

  const [postsResult, commentsResult, likesResult, visitsResult] =
    await Promise.all([
      supabase
        .from("blog_posts")
        .select("id, title, content, image_urls, created_at")
        .or(byAccount)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("blog_comments")
        .select("id, post_id, content, created_at")
        .or(byAccount)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("blog_post_likes")
        .select("id, post_id, created_at")
        .or(byAccount)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("site_visits")
        .select("*")
        .eq("user_id", user.id)
        .order("visit_date", { ascending: false })
        .limit(100),
    ]);

  const posts = (postsResult.data ?? []) as PostRow[];
  const comments = (commentsResult.data ?? []) as CommentRow[];
  const likes = (likesResult.data ?? []) as LikeRow[];
  const visits = (visitsResult.data ?? []) as VisitRow[];

  // Titles for whatever they commented on or liked.
  const commentedPostIds = Array.from(
    new Set([
      ...comments.map((comment) => comment.post_id),
      ...likes.map((like) => like.post_id),
    ]),
  );

  const postTitles = new Map<string, string>();

  if (commentedPostIds.length > 0) {
    const { data: titleRows } = await supabase
      .from("blog_posts")
      .select("id, title")
      .in("id", commentedPostIds);

    for (const row of titleRows ?? []) {
      postTitles.set(row.id as string, row.title as string);
    }
  }

  const displayName =
    user.username ?? user.full_name ?? user.email ?? user.id.slice(0, 8);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AdminNav adminEmail={admin.email} active="users" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/"
          className="text-sm text-neutral-500 underline transition hover:text-neutral-900"
        >
          ← All users
        </Link>

        <header className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt=""
                referrerPolicy="no-referrer"
                className="h-14 w-14 rounded-full border border-neutral-200"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-200 text-lg font-bold text-neutral-500">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>

              <p className="text-sm text-neutral-500">
                {user.full_name ?? "—"}
                {user.email ? ` · ${user.email}` : ""}
                {user.email_verified === true ? " · verified" : ""}
              </p>
            </div>
          </div>

          <UserActions
            userId={user.id}
            username={displayName}
            redirectTo="/"
          />
        </header>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Card title="Account">
            <Field label="Username" value={user.username ?? "not chosen yet"} />
            <Field label="Account created" value={formatDate(user.created_at)} />
            <Field
              label="First login"
              value={formatDate(user.first_login_at ?? user.created_at)}
            />
            <Field label="Last login" value={formatDate(user.last_login_at)} />
            <Field label="Total logins" value={user.login_count ?? 0} />
            <Field
              label="Metadata updated"
              value={formatDate(user.metadata_updated_at)}
            />
            <Field label="Internal id" value={user.id} mono />
          </Card>

          <Card title="Google profile">
            <Field
              label="Sign-in method"
              value={user.google_sub ? "Google" : "Legacy password account"}
            />
            <Field label="Google account id" value={user.google_sub} mono />
            <Field label="Given name" value={user.given_name} />
            <Field label="Family name" value={user.family_name} />
            <Field label="Email verified" value={
              user.email_verified === null
                ? null
                : user.email_verified
                  ? "Yes"
                  : "No"
            } />
            <Field label="Workspace domain" value={user.google_hosted_domain} />
            <Field label="Google locale" value={user.google_locale} />
          </Card>

          <Card title="Location & network">
            <Field label="IP address" value={user.last_ip} mono />
            <Field label="City" value={user.ip_city} />
            <Field label="Region" value={user.ip_region} />
            <Field label="Country" value={user.country_code} />
            <Field label="Time zone" value={user.timezone} />
            <Field label="Connection type" value={user.connection_type} />
          </Card>

          <Card title="Device & browser">
            <Field label="Platform" value={user.device_platform} />
            <Field label="Screen" value={user.screen_size} />
            <Field label="CPU cores" value={user.cpu_cores} />
            <Field
              label="Device memory"
              value={
                user.device_memory_gb ? `${user.device_memory_gb} GB` : null
              }
            />
            <Field label="Browser language" value={user.browser_language} />
            <Field
              label="All languages"
              value={(user.browser_languages ?? []).join(", ") || null}
            />
            <Field label="Arrived from" value={user.referrer} />
            <Field label="User agent" value={user.user_agent} mono />
          </Card>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-bold">
            Posts{" "}
            <span className="text-sm font-normal text-neutral-500">
              ({posts.length})
            </span>
          </h2>

          {posts.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {posts.map((post) => (
                <li
                  key={post.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">{post.title}</p>

                    <p className="text-xs text-neutral-500">
                      {formatDate(post.created_at)}
                    </p>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-600">
                    {post.content.length > 400
                      ? `${post.content.slice(0, 400)}…`
                      : post.content}
                  </p>

                  <p className="mt-2 text-xs text-neutral-400">
                    {(post.image_urls ?? []).length} photo
                    {(post.image_urls ?? []).length === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">No posts.</p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold">
            Comments{" "}
            <span className="text-sm font-normal text-neutral-500">
              ({comments.length})
            </span>
          </h2>

          {comments.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs text-neutral-500">
                      on “{postTitles.get(comment.post_id) ?? "deleted post"}”
                    </p>

                    <p className="text-xs text-neutral-500">
                      {formatDate(comment.created_at)}
                    </p>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-700">
                    {comment.content}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">No comments.</p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold">
            Likes{" "}
            <span className="text-sm font-normal text-neutral-500">
              ({likes.length})
            </span>
          </h2>

          {likes.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {likes.map((like) => (
                <li
                  key={like.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-3"
                >
                  <span className="text-sm font-semibold">
                    {postTitles.get(like.post_id) ?? "(post deleted)"}
                  </span>

                  <span className="text-xs text-neutral-500">
                    {formatDate(like.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">
              Nothing liked yet.
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold">
            Visits{" "}
            <span className="text-sm font-normal text-neutral-500">
              ({visits.length})
            </span>
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Each day this account was seen on the shop, and for how long.
          </p>

          {visits.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Stayed</th>
                    <th className="px-4 py-3">Views</th>
                    <th className="px-4 py-3">Where from</th>
                    <th className="px-4 py-3">Device</th>
                  </tr>
                </thead>

                <tbody>
                  {visits.map((visit) => (
                    <tr
                      key={visit.id}
                      className="border-b border-neutral-100 align-top last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        {visit.visit_date}

                        <p className="text-xs text-neutral-400">
                          from {formatDate(visit.first_seen_at)}
                        </p>
                      </td>

                      <td className="px-4 py-3 font-semibold">
                        {stayLength(visit.first_seen_at, visit.last_seen_at)}
                      </td>

                      <td className="px-4 py-3">{visit.page_views}</td>

                      <td className="px-4 py-3 text-xs text-neutral-600">
                        <p className="font-mono">{visit.ip_address ?? "—"}</p>

                        <p>
                          {[visit.ip_city, visit.ip_region, visit.ip_country]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </p>

                        <p className="max-w-48 truncate text-neutral-400">
                          {visit.referrer ?? "direct"}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-xs text-neutral-600">
                        <p>
                          {visit.device_platform ?? "—"}
                          {visit.screen_size ? ` · ${visit.screen_size}` : ""}
                        </p>

                        <p
                          className="max-w-56 truncate text-neutral-400"
                          title={visit.user_agent ?? ""}
                        >
                          {visit.user_agent ?? "—"}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">
              No visits recorded for this account yet.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
