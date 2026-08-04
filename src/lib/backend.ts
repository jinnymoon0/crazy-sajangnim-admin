/*
 * Calls to the product service (crazy-sajangnim-backend). The token is
 * only ever used from the server, never handed to the browser.
 */
export function getBackendUrl(): string | null {
  return process.env.BACKEND_URL?.trim() || null;
}

export async function backendFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    throw new Error("BACKEND_URL is not configured.");
  }

  const token = process.env.BACKEND_API_TOKEN?.trim();

  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(new URL(path, backendUrl), {
    ...init,
    headers,
    cache: "no-store",
    /*
     * Adding a brand searches for its own shop and for the shops that
     * stock it, and collecting crawls every source. A minute is not
     * enough for either; cutting them off leaves the brand half-set-up.
     */
    signal: AbortSignal.timeout(240_000),
  });
}
