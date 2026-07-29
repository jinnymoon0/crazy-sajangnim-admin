import { redirect } from "next/navigation";

import { auth, isAllowedAdminEmail, signIn } from "@/auth";

export const dynamic = "force-dynamic";

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error } = await searchParams;

  const session = await auth();

  if (session?.user?.email && (await isAllowedAdminEmail(session.user.email))) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-neutral-50 px-4 text-neutral-900">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold">Crazy Sajangnim Admin</h1>

        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Sign in with a Google account that has been granted admin
          access.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error === "AccessDenied"
              ? "That Google account does not have admin access."
              : "Sign-in failed. Please try again."}
          </p>
        ) : null}

        <form
          action={async () => {
            "use server";

            await signIn("google", { redirectTo: "/" });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-neutral-300 bg-white px-5 text-sm font-semibold transition hover:bg-neutral-100"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
            >
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.8c2.2-2 3.7-5 3.7-8.5z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.8c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 2.9C3.3 21.3 7.3 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.2 14.5c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2L1.3 7.2C.5 8.7 0 10.3 0 12.3s.5 3.6 1.3 5.1l3.9-2.9z"
              />
              <path
                fill="#EA4335"
                d="M12 4.8c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.3 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3C6.1 6.9 8.8 4.8 12 4.8z"
              />
            </svg>
            Sign in with Google
          </button>
        </form>
      </div>

      <p className="max-w-sm text-center text-xs leading-5 text-neutral-400">
        Access is limited to emails on the admin list. Ask an existing
        admin to add your Gmail address.
      </p>
    </main>
  );
}
