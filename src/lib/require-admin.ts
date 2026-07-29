import { redirect } from "next/navigation";

import { auth, isAllowedAdminEmail } from "@/auth";

export interface AdminIdentity {
  email: string;
  name: string;
}

/*
 * Guard for every admin page and server action: a signed-in Google
 * session whose email is still on the allowlist. Removal from the
 * allowlist locks an admin out on their next request.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    redirect("/signin");
  }

  if (!(await isAllowedAdminEmail(email))) {
    redirect("/signin?error=AccessDenied");
  }

  return {
    email,
    name: session?.user?.name ?? email,
  };
}
