"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/require-admin";
import {
  generateTemporaryPassword,
  hashSecret,
} from "@/lib/passwords";
import { getSupabaseAdmin } from "@/lib/supabase";

export interface ActionResult {
  ok: boolean;
  message: string;
  temporaryPassword?: string;
}

/*
 * Issue a one-time temporary password for a site user. The password is
 * shown to the admin exactly once and stored only as a hash; every
 * existing session for the user is revoked.
 */
export async function resetUserPassword(
  userId: string,
): Promise<ActionResult> {
  await requireAdmin();

  if (!z.string().uuid().safeParse(userId).success) {
    return { ok: false, message: "Invalid user id." };
  }

  const supabase = getSupabaseAdmin();
  const temporaryPassword = generateTemporaryPassword();

  const { data, error } = await supabase
    .from("site_users")
    .update({ password_hash: hashSecret(temporaryPassword) })
    .eq("id", userId)
    .select("username")
    .maybeSingle();

  if (error || !data) {
    console.error("Password reset failed:", error);

    return { ok: false, message: "Failed to reset the password." };
  }

  await supabase.from("site_sessions").delete().eq("user_id", userId);

  return {
    ok: true,
    message: `Temporary password for ${data.username} — share it privately; it is shown only once:`,
    temporaryPassword,
  };
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  await requireAdmin();

  if (!z.string().uuid().safeParse(userId).success) {
    return { ok: false, message: "Invalid user id." };
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("site_users")
    .delete()
    .eq("id", userId)
    .select("username")
    .maybeSingle();

  if (error || !data) {
    console.error("User deletion failed:", error);

    return { ok: false, message: "Failed to delete the account." };
  }

  revalidatePath("/");

  return {
    ok: true,
    message: `Deleted the account "${data.username}".`,
  };
}

export async function addAdminEmail(
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .safeParse(formData.get("email"));

  if (!parsed.success) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("admin_emails").insert({
    email: parsed.data,
    added_by: admin.email,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "That email is already an admin." };
    }

    console.error("Admin add failed:", error);

    return { ok: false, message: "Failed to add the admin." };
  }

  revalidatePath("/admins");

  return { ok: true, message: `${parsed.data} can now sign in.` };
}

export async function removeAdminEmail(
  email: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const normalized = email.trim().toLowerCase();

  if (normalized === admin.email) {
    return {
      ok: false,
      message: "You cannot remove your own admin access.",
    };
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("admin_emails")
    .delete()
    .eq("email", normalized);

  if (error) {
    console.error("Admin removal failed:", error);

    return { ok: false, message: "Failed to remove the admin." };
  }

  revalidatePath("/admins");

  return { ok: true, message: `${normalized} can no longer sign in.` };
}
