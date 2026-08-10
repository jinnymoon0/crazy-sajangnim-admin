import { NextResponse } from "next/server";

import {
  fetchRecordings,
  readReplayConfig,
  ReplayApiError,
} from "@/lib/posthog";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Session recordings, for the admin only.
 *
 * The route exists so the personal API key stays on the server. The
 * page could not call PostHog directly without shipping a key that can
 * read and write the whole project to every browser that opens the
 * admin.
 */
export async function GET(request: Request) {
  /*
   * requireAdmin redirects a page; here it also serves as the gate,
   * because an unauthenticated caller must not reach PostHog through
   * us. A redirect from a fetch is not useful to the caller, so the
   * outcome is reported as JSON.
   */
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: "Sign in as an admin." },
      { status: 401 },
    );
  }

  const configResult = readReplayConfig();

  if (!configResult.ok) {
    /*
     * Not an error the caller made, and not something retrying fixes.
     * 503 with the list of what is missing, so the page can say which
     * variables to set rather than "something went wrong".
     */
    return NextResponse.json(
      {
        error: "Session replay is not configured.",
        missing: configResult.missing,
      },
      { status: 503 },
    );
  }

  const offsetParam = new URL(request.url).searchParams.get("offset");

  const offset = Number.parseInt(offsetParam ?? "0", 10);

  try {
    const page = await fetchRecordings(configResult.config, {
      offset: Number.isFinite(offset) ? offset : 0,
    });

    return NextResponse.json(page, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ReplayApiError) {
      console.error("PostHog replay request failed:", error.message);

      /*
       * PostHog's status is not this route's status: a 401 from them is
       * our misconfiguration, not the admin's lack of permission, and
       * answering 401 here would read as "sign in again".
       */
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    console.error("Replay route error:", error);

    return NextResponse.json(
      { error: "Could not load recordings." },
      { status: 500 },
    );
  }
}
