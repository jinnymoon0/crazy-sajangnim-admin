import AdminNav from "@/components/AdminNav";
import UserActions from "@/components/UserActions";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/*
 * One row per site account. Every profile field Google shares during
 * sign-in is stored and shown here; passwords do not exist under
 * Google login, so accounts can only be deleted, never inspected.
 */
interface SiteUserRow {
  id: string;
  username: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email_verified: boolean | null;
  google_sub: string | null;
  given_name: string | null;
  family_name: string | null;
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
  login_count: number;
  metadata_updated_at: string | null;
  created_at: string;
}

interface ActivityCounts {
  posts: number;
  comments: number;
}

function formatDate(value: string | null): string {
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

async function getUsers(): Promise<{
  users: SiteUserRow[];
  tablesReady: boolean;
}> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("site_users")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("User list failed:", {
        code: error.code,
        message: error.message,
      });
    }

    return { users: [], tablesReady: false };
  }

  return { users: (data ?? []) as SiteUserRow[], tablesReady: true };
}

/*
 * Posts and comments are stamped with the author's username, so
 * activity is aggregated per username.
 */
async function getActivityByUsername(): Promise<Map<string, ActivityCounts>> {
  const supabase = getSupabaseAdmin();
  const activity = new Map<string, ActivityCounts>();

  const bump = (
    username: string | null,
    key: keyof ActivityCounts,
  ) => {
    if (!username) {
      return;
    }

    const entry = activity.get(username) ?? { posts: 0, comments: 0 };
    entry[key] += 1;
    activity.set(username, entry);
  };

  const [posts, comments] = await Promise.all([
    supabase.from("blog_posts").select("author_name").limit(5000),
    supabase.from("blog_comments").select("author_name").limit(5000),
  ]);

  for (const row of posts.data ?? []) {
    bump(row.author_name, "posts");
  }

  for (const row of comments.data ?? []) {
    bump(row.author_name, "comments");
  }

  return activity;
}

export default async function UsersPage() {
  const admin = await requireAdmin();
  const { users, tablesReady } = await getUsers();
  const activity = await getActivityByUsername();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AdminNav adminEmail={admin.email} active="users" />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-bold">Site users</h1>

        <p className="mt-2 text-sm text-neutral-500">
          {users.length} {users.length === 1 ? "account" : "accounts"}.
          Everything Google shares at sign-in is shown below. Sign-in is
          handled by Google, so there are no passwords to view or reset.
        </p>

        {!tablesReady ? (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            The account tables have not been created yet. Run
            supabase/auth.sql from the main repository in the Supabase SQL
            editor.
          </div>
        ) : null}

        {users.length > 0 ? (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Google profile</th>
                  <th className="px-4 py-3">Language</th>
                  <th className="px-4 py-3">Location / Network</th>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">First login</th>
                  <th className="px-4 py-3">Last login</th>
                  <th className="px-4 py-3">Logins</th>
                  {/* Pinned so it stays reachable while the wide table scrolls. */}
                  <th className="sticky right-0 z-10 border-l border-neutral-200 bg-neutral-50 px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-neutral-100 align-top last:border-b-0"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={user.avatar_url}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-9 w-9 rounded-full border border-neutral-200"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-500">
                            {(user.username ?? user.full_name ?? "?")
                              .slice(0, 1)
                              .toUpperCase()}
                          </div>
                        )}

                        <div>
                          <p className="font-semibold">
                            {user.full_name ?? "—"}
                          </p>

                          {user.google_sub ? (
                            <p className="text-xs text-neutral-400">
                              Google · {user.google_sub.slice(0, 12)}…
                            </p>
                          ) : (
                            <p className="text-xs text-amber-600">
                              Legacy password account
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 font-semibold">
                      {user.username ?? (
                        <span className="font-normal text-neutral-400">
                          not chosen yet
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-neutral-600">
                      {user.email ?? "—"}
                      {user.email_verified === true ? (
                        <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          verified
                        </span>
                      ) : null}
                    </td>

                    <td className="px-4 py-4 text-xs text-neutral-600">
                      <p>{user.google_sub ? "Google" : "Password"}</p>
                      <p>{user.given_name ?? "—"} {user.family_name ?? ""}</p>
                      {user.google_hosted_domain ? (
                        <p className="text-neutral-400">
                          {user.google_hosted_domain}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-4 text-xs text-neutral-600">
                      <p>Google: {user.google_locale ?? "—"}</p>
                      <p>Browser: {user.browser_language ?? "—"}</p>
                      <p className="max-w-48 break-words text-neutral-400">
                        {(user.browser_languages ?? []).join(", ") || "—"}
                      </p>
                    </td>

                    <td className="px-4 py-4 text-xs text-neutral-600">
                      <p>
                        {[user.ip_city, user.ip_region, user.country_code]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </p>
                      <p>Time zone: {user.timezone ?? "—"}</p>
                      <p className="text-neutral-400">
                        IP: {user.last_ip ?? "—"}
                      </p>
                      {user.connection_type ? (
                        <p className="text-neutral-400">
                          Network: {user.connection_type}
                        </p>
                      ) : null}
                    </td>

                    <td
                      className="px-4 py-4 text-xs text-neutral-600"
                      title={user.user_agent ?? undefined}
                    >
                      <p>{user.device_platform ?? "—"}</p>
                      <p>Screen: {user.screen_size ?? "—"}</p>
                      <p className="text-neutral-400">
                        {[
                          user.cpu_cores ? `${user.cpu_cores} cores` : null,
                          user.device_memory_gb
                            ? `${user.device_memory_gb} GB`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      {user.referrer ? (
                        <p className="max-w-40 truncate text-neutral-400">
                          via {user.referrer}
                        </p>
                      ) : null}
                    </td>

                    <td className="px-4 py-4 text-xs text-neutral-600">
                      {(() => {
                        const counts = user.username
                          ? activity.get(user.username)
                          : undefined;

                        return (
                          <>
                            <p>{counts?.posts ?? 0} posts</p>
                            <p>{counts?.comments ?? 0} comments</p>
                          </>
                        );
                      })()}
                    </td>

                    <td className="px-4 py-4 text-neutral-600">
                      {formatDate(user.first_login_at ?? user.created_at)}
                    </td>

                    <td className="px-4 py-4 text-neutral-600">
                      {formatDate(user.last_login_at)}
                    </td>

                    <td className="px-4 py-4 text-center font-semibold">
                      {user.login_count ?? 0}
                    </td>

                    <td className="sticky right-0 z-10 border-l border-neutral-200 bg-white px-4 py-4">
                      <UserActions
                        userId={user.id}
                        username={
                          user.username ?? user.email ?? user.id.slice(0, 8)
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tablesReady ? (
          <p className="mt-8 text-sm text-neutral-500">
            No accounts yet.
          </p>
        ) : null}
      </main>
    </div>
  );
}
