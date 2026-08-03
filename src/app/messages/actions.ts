"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function setMessageRead(
  id: string,
  isRead: boolean,
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();

  const { error } = await getSupabaseAdmin()
    .from("contact_messages")
    .update({ is_read: isRead })
    .eq("id", id);

  if (error) {
    console.error("Message read toggle failed:", error.message);

    return { ok: false, message: "Could not update the message." };
  }

  revalidatePath("/messages");

  return { ok: true, message: isRead ? "Marked read." : "Marked unread." };
}
