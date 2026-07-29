import AdminNav from "@/components/AdminNav";
import UserActions from "@/components/UserActions";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface SiteUserRow {
  id: string;
  username: string;
  created_at: string;
  last_login_at: string | null;
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
    .select("id, username, created_at, last_login_at")
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

export default async function UsersPage() {
  const admin = await requireAdmin();
  const { users, tablesReady } = await getUsers();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AdminNav adminEmail={admin.email} active="users" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-bold">Site users</h1>

        <p className="mt-2 text-sm text-neutral-500">
          {users.length} {users.length === 1 ? "account" : "accounts"}.
          Passwords are stored as one-way hashes — they cannot be viewed,
          only reset.
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
                  <th className="px-5 py-3">Username</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Last login</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-neutral-100 align-top last:border-b-0"
                  >
                    <td className="px-5 py-4 font-semibold">
                      {user.username}
                    </td>

                    <td className="px-5 py-4 text-neutral-600">
                      {formatDate(user.created_at)}
                    </td>

                    <td className="px-5 py-4 text-neutral-600">
                      {formatDate(user.last_login_at)}
                    </td>

                    <td className="px-5 py-4">
                      <UserActions
                        userId={user.id}
                        username={user.username}
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
