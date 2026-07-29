import { redirect } from "next/navigation";

import { auth, isAllowedAdminEmail } from "@/auth";
import GoogleSignInButton from "@/components/GoogleSignInButton";

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

        <div className="mt-6">
          <GoogleSignInButton />
        </div>
      </div>

      <p className="max-w-sm text-center text-xs leading-5 text-neutral-400">
        Access is limited to emails on the admin list. Ask an existing
        admin to add your Gmail address.
      </p>
    </main>
  );
}
