import Link from "next/link";

import AdminNav from "@/components/AdminNav";
import MessageReadToggle from "@/components/MessageReadToggle";
import { requireAdmin } from "@/lib/require-admin";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface MessageRow {
  id: string;
  user_id: string | null;
  topic: "brand" | "bug" | "other";
  message: string;
  ip_address: string | null;
  user_agent: string | null;
  is_read: boolean;
  created_at: string;
}

interface SenderRow {
  id: string;
  username: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
}

const TOPIC_LABELS: Record<MessageRow["topic"], string> = {
  brand: "Brand request",
  bug: "Problem report",
  other: "Something else",
};

const TOPIC_STYLES: Record<MessageRow["topic"], string> = {
  brand: "bg-sky-50 text-sky-700",
  bug: "bg-amber-50 text-amber-800",
  other: "bg-neutral-100 text-neutral-600",
};

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

async function getMessages(): Promise<{
  messages: MessageRow[];
  senders: Map<string, SenderRow>;
  tableReady: boolean;
}> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("Message list failed:", {
        code: error.code,
        message: error.message,
      });
    }

    return { messages: [], senders: new Map(), tableReady: false };
  }

  const messages = (data ?? []) as MessageRow[];

  /*
   * The sender is read live rather than copied onto the message, so a
   * user who renames themselves shows under their current name.
   */
  const senderIds = Array.from(
    new Set(
      messages
        .map((message) => message.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const senders = new Map<string, SenderRow>();

  if (senderIds.length > 0) {
    const { data: users, error: userError } = await supabase
      .from("site_users")
      .select("id, username, email, full_name, avatar_url, created_at")
      .in("id", senderIds);

    if (userError) {
      console.error("Message sender lookup failed:", userError.message);
    }

    for (const user of (users ?? []) as SenderRow[]) {
      senders.set(user.id, user);
    }
  }

  return { messages, senders, tableReady: true };
}

export default async function MessagesPage() {
  const admin = await requireAdmin();
  const { messages, senders, tableReady } = await getMessages();

  const unread = messages.filter((message) => !message.is_read).length;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AdminNav adminEmail={admin.email} active="messages" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <header>
          <h1 className="text-2xl font-bold">Messages</h1>

          <p className="mt-1 text-sm text-neutral-500">
            Brand requests, problem reports, and anything else sent from
            the shop&rsquo;s contact box.
            {messages.length > 0
              ? ` ${messages.length} in total, ${unread} unread.`
              : ""}
          </p>
        </header>

        {!tableReady ? (
          <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            The contact_messages table does not exist yet. Run
            supabase/contact.sql from the shopping site repository.
          </p>
        ) : messages.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
            No one has sent a message yet.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {messages.map((message) => {
              const sender = message.user_id
                ? senders.get(message.user_id)
                : undefined;

              return (
                <li
                  key={message.id}
                  className={`rounded-2xl border bg-white p-5 ${
                    message.is_read
                      ? "border-neutral-200"
                      : "border-neutral-400"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${TOPIC_STYLES[message.topic]}`}
                      >
                        {TOPIC_LABELS[message.topic] ?? message.topic}
                      </span>

                      {message.is_read ? null : (
                        <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-white">
                          New
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-500">
                        {formatDate(message.created_at)}
                      </span>

                      <MessageReadToggle
                        id={message.id}
                        isRead={message.is_read}
                      />
                    </div>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
                    {message.message}
                  </p>

                  <dl className="mt-5 grid gap-x-6 gap-y-2 border-t border-neutral-100 pt-4 text-xs sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="text-neutral-400">From</dt>

                      <dd className="min-w-0">
                        {sender ? (
                          <Link
                            href={`/users/${sender.id}`}
                            className="font-semibold underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-950"
                          >
                            {sender.username ?? "(no username yet)"}
                          </Link>
                        ) : (
                          <span className="text-neutral-400">
                            account deleted
                          </span>
                        )}
                      </dd>
                    </div>

                    <div className="flex gap-2">
                      <dt className="text-neutral-400">Email</dt>

                      <dd className="min-w-0 break-all text-neutral-600">
                        {sender?.email ?? "—"}
                      </dd>
                    </div>

                    <div className="flex gap-2">
                      <dt className="text-neutral-400">Google name</dt>

                      <dd className="min-w-0 text-neutral-600">
                        {sender?.full_name ?? "—"}
                      </dd>
                    </div>

                    <div className="flex gap-2">
                      <dt className="text-neutral-400">Joined</dt>

                      <dd className="text-neutral-600">
                        {formatDate(sender?.created_at ?? null)}
                      </dd>
                    </div>

                    <div className="flex gap-2">
                      <dt className="text-neutral-400">IP</dt>

                      <dd className="font-mono text-neutral-600">
                        {message.ip_address ?? "—"}
                      </dd>
                    </div>

                    <div className="flex gap-2">
                      <dt className="shrink-0 text-neutral-400">Device</dt>

                      <dd
                        className="min-w-0 truncate text-neutral-500"
                        title={message.user_agent ?? undefined}
                      >
                        {message.user_agent ?? "—"}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
