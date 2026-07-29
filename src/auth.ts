import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { getSupabaseAdmin } from "@/lib/supabase";

/*
 * Only emails present in the shared admin_emails table may sign in.
 */
export async function isAllowedAdminEmail(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) {
    return false;
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("admin_emails")
      .select("email")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error("Admin allowlist lookup failed:", {
        code: error.code,
        message: error.message,
      });

      return false;
    }

    return Boolean(data);
  } catch (error) {
    console.error("Admin allowlist error:", error);

    return false;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],

  pages: {
    signIn: "/signin",
    error: "/signin",
  },

  callbacks: {
    async signIn({ user }) {
      return isAllowedAdminEmail(user.email);
    },
  },
});
