import Link from "next/link";
import { notFound } from "next/navigation";

import AdminNav from "@/components/AdminNav";
import { backendFetch, getBackendUrl } from "@/lib/backend";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

type Market = "US" | "KR";

interface Segment {
  market: Market;
  gender: "MEN" | "WOMEN";
  count: number;
}

interface SourceCount {
  sourceName: string;
  count: number;
}

interface Breakdown {
  slug: string;
  englishName: string;
  koreanName: string | null;
  storeDomain: string | null;
  total: number;
  totalByMarket: Record<Market, number>;
  segments: Segment[];
  sources: Record<Market, SourceCount[]>;
}

const MARKET_LABELS: Record<Market, string> = {
  US: "United States",
  KR: "Korea",
};

async function getBreakdown(
  slug: string,
): Promise<{ breakdown: Breakdown | null; error: string | null }> {
  if (!getBackendUrl()) {
    return {
      breakdown: null,
      error:
        "BACKEND_URL is not configured, so the product service cannot be reached.",
    };
  }

  try {
    const response = await backendFetch(
      `/api/brands/${encodeURIComponent(slug)}/breakdown`,
    );

    /*
     * A 404 means either the brand is untracked or the product service
     * has no breakdown endpoint yet. Only the first is really "not
     * found"; the service says so in JSON, while a missing route answers
     * with the service's own error page. Telling them apart keeps a
     * service that needs deploying from looking like a missing brand.
     */
    if (response.status === 404) {
      const body: unknown = await response.json().catch(() => null);

      const isKnownBrandError =
        typeof body === "object" && body !== null && "error" in body;

      return {
        breakdown: null,
        error: isKnownBrandError
          ? null
          : "The product service has no breakdown for this brand yet. It is running an older version — deploy the backend to see this page.",
      };
    }

    if (!response.ok) {
      return {
        breakdown: null,
        error: `The product service answered ${response.status}.`,
      };
    }

    return {
      breakdown: (await response.json()) as Breakdown,
      error: null,
    };
  } catch (error) {
    console.error("Brand breakdown failed:", error);

    return {
      breakdown: null,
      error: "The product service could not be reached.",
    };
  }
}

function SegmentCard({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-bold ${
          count > 0 ? "text-neutral-950" : "text-neutral-300"
        }`}
      >
        {count}
      </p>

      <p className="mt-1 text-xs text-neutral-400">
        {count === 1 ? "item on sale" : "items on sale"}
      </p>
    </div>
  );
}

function SourceTable({
  market,
  sources,
  total,
}: {
  market: Market;
  sources: SourceCount[];
  total: number;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold">{MARKET_LABELS[market]}</h2>

        <span className="text-xs text-neutral-500">
          {total} {total === 1 ? "item" : "items"} across {sources.length}{" "}
          {sources.length === 1 ? "site" : "sites"}
        </span>
      </div>

      {sources.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          Nothing from this brand is on sale on the {MARKET_LABELS[market]}{" "}
          store right now.
        </p>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="py-2">Site</th>
              <th className="w-20 py-2 text-right">Items</th>
            </tr>
          </thead>

          <tbody>
            {sources.map((source) => (
              <tr
                key={source.sourceName}
                className="border-b border-neutral-100 last:border-b-0"
              >
                <td className="py-2.5 pr-3">
                  <span className="break-words">{source.sourceName}</span>
                </td>

                <td className="py-2.5 text-right font-semibold">
                  {source.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const admin = await requireAdmin();
  const { slug } = await params;
  const { breakdown, error } = await getBreakdown(slug);

  if (!breakdown && !error) {
    notFound();
  }

  function segmentCount(market: Market, gender: "MEN" | "WOMEN"): number {
    return (
      breakdown?.segments.find(
        (segment) => segment.market === market && segment.gender === gender,
      )?.count ?? 0
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AdminNav adminEmail={admin.email} active="brands" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/brands"
          className="text-sm text-neutral-500 underline underline-offset-2 hover:text-neutral-950"
        >
          ← All brands
        </Link>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : breakdown ? (
          <>
            <header className="mt-4">
              <h1 className="text-2xl font-bold">{breakdown.englishName}</h1>

              <p className="mt-1 text-sm text-neutral-500">
                {breakdown.total}{" "}
                {breakdown.total === 1 ? "item" : "items"} on sale
                {breakdown.koreanName ? ` · ${breakdown.koreanName}` : ""}
                {breakdown.storeDomain ? " · own site " : ""}
                {breakdown.storeDomain ? (
                  <a
                    href={`https://${breakdown.storeDomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-neutral-950"
                  >
                    {breakdown.storeDomain}
                  </a>
                ) : null}
              </p>
            </header>

            <h2 className="mt-8 text-sm font-bold">By section of the shop</h2>

            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SegmentCard
                label="US · Men"
                count={segmentCount("US", "MEN")}
              />
              <SegmentCard
                label="US · Women"
                count={segmentCount("US", "WOMEN")}
              />
              <SegmentCard
                label="Korea · Men"
                count={segmentCount("KR", "MEN")}
              />
              <SegmentCard
                label="Korea · Women"
                count={segmentCount("KR", "WOMEN")}
              />
            </div>

            <p className="mt-3 text-xs text-neutral-500">
              Unisex items show in both the men&rsquo;s and women&rsquo;s
              sections, so these four can add up to more than{" "}
              {breakdown.total}.
            </p>

            <h2 className="mt-10 text-sm font-bold">By site</h2>

            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <SourceTable
                market="US"
                sources={breakdown.sources.US}
                total={breakdown.totalByMarket.US}
              />

              <SourceTable
                market="KR"
                sources={breakdown.sources.KR}
                total={breakdown.totalByMarket.KR}
              />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
