import { NextResponse } from "next/server";

import { fetchPanels, readReplayConfig, ReplayApiError } from "@/lib/posthog";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Six queries against PostHog, run together. */
export const maxDuration = 60;

/*
 * PostHog's analytics, for the admin only — same reasoning as the
 * replay route. The personal API key can read the whole project, so it
 * never leaves the server.
 */
export async function GET() {
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
    return NextResponse.json(
      {
        error: "PostHog is not configured.",
        missing: configResult.missing,
      },
      { status: 503 },
    );
  }

  try {
    const result = await fetchPanels(configResult.config);

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ReplayApiError) {
      console.error("PostHog analytics failed:", error.message);

      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    console.error("PostHog analytics error:", error);

    return NextResponse.json(
      { error: "Could not load analytics." },
      { status: 500 },
    );
  }
}
