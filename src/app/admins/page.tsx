import { addAdminEmail } from "@/app/actions";
import AdminEmailRow from "@/components/AdminEmailRow";
import AdminNav from "@/components/AdminNav";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface AdminEmailEntry {
  email: string;
  added_by: string | null;
  created_at: string;
}

async function getAdminEmails(): Promise<AdminEmailEntry[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("admin_emails")
    .select("email, added_by, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("Admin list failed:", {
        code: error.code,
        message: error.message,
      });
    }

    return [];
  }

  return (data ?? []) as AdminEmailEntry[];
}

export default async function AdminsPage() {
  const admin = await requireAdmin();
  const admins = await getAdminEmails();

  async function handleAdd(formData: FormData) {
    "use server";

    await addAdminEmail(formData);
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AdminNav adminEmail={admin.email} active="admins" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-bold">Admin access</h1>

        <p className="mt-2 text-sm text-neutral-500">
          Anyone whose Gmail address is on this list can sign in to this
          dashboard with Google.
        </p>

        <form
          action={handleAdd}
          className="mt-8 flex max-w-md flex-wrap gap-3"
        >
          <input
            name="email"
            type="email"
            required
            placeholder="person@gmail.com"
            className="min-w-60 flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-950"
          />

          <button
            type="submit"
            className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800"
          >
            Add admin
          </button>
        </form>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Added by</th>
                <th className="px-5 py-3">Added</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>

            <tbody>
              {admins.map((entry) => (
                <tr
                  key={entry.email}
                  className="border-b border-neutral-100 last:border-b-0"
                >
                  <td className="px-5 py-4 font-semibold">{entry.email}</td>

                  <td className="px-5 py-4 text-neutral-600">
                    {entry.added_by ?? "—"}
                  </td>

                  <td className="px-5 py-4 text-neutral-600">
                    {new Intl.DateTimeFormat("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    }).format(new Date(entry.created_at))}
                  </td>

                  <td className="px-5 py-4">
                    <AdminEmailRow
                      email={entry.email}
                      isSelf={entry.email === admin.email}
                    />
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
