import Link from "next/link";

import { signOut } from "@/auth";

interface AdminNavProps {
  adminEmail: string;
  active: "users" | "admins";
}

export default function AdminNav({ adminEmail, active }: AdminNavProps) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-6">
          <p className="text-sm font-bold">Crazy Sajangnim Admin</p>

          <nav className="flex gap-4 text-sm">
            <Link
              href="/"
              className={
                active === "users"
                  ? "font-semibold text-neutral-950 underline"
                  : "text-neutral-500 hover:text-neutral-950"
              }
            >
              Users
            </Link>

            <Link
              href="/admins"
              className={
                active === "admins"
                  ? "font-semibold text-neutral-950 underline"
                  : "text-neutral-500 hover:text-neutral-950"
              }
            >
              Admins
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-500">{adminEmail}</span>

          <form
            action={async () => {
              "use server";

              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-900 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
