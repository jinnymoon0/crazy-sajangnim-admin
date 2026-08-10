import AdminNav from "@/components/AdminNav";
import { requireAdmin } from "@/lib/require-admin";
import { RETENTION_DAYS } from "@/lib/posthog";

import SessionReplayList from "./SessionReplayList";

export const dynamic = "force-dynamic";

/*
 * Watching what people actually did, as opposed to counting it.
 *
 * The list is fetched by the client from /api/replays so the personal
 * API key never leaves the server — this page imports only the
 * retention figure, which is a number, not a credential.
 *
 * Playback is not embedded. A player in this page would need PostHog
 * credentials in the browser to fetch the events, which is the one
 * thing the whole arrangement exists to avoid.
 */
export default async function ReplaysPage() {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AdminNav adminEmail={admin.email} active="replays" />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <header>
          <h1 className="text-2xl font-bold">Session Replay</h1>

          <p className="mt-1 text-sm text-neutral-500">
            Recordings of real sessions, signed in or not. Everything anyone
            types is masked before it leaves their browser, and playback
            opens in PostHog.
          </p>
        </header>

        <SessionReplayList retentionDays={RETENTION_DAYS} />
      </main>
    </div>
  );
}
