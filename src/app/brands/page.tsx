import Link from "next/link";

import AdminNav from "@/components/AdminNav";
import BrandBar from "@/components/BrandBar";
import BrandRow from "@/components/BrandRow";
import { backendFetch, getBackendUrl } from "@/lib/backend";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/*
 * A collection run walks every retailer for the brand and takes two to
 * three minutes. Server actions inherit this page's limit, and without
 * it they fall back to the platform default of a minute — so adding a
 * brand reported a failure while the backend was still working and
 * about to succeed. Matches the backend route's own ceiling.
 */
export const maxDuration = 300;

interface Brand {
  slug: string;
  englishName: string;
  koreanName: string | null;
  aliases: string[];
  isActive: boolean;
  addedBy: string | null;
  createdAt: string | null;
  productCount?: number | null;
  productCountByMarket?: { US: number; KR: number; JP: number } | null;
  storeDomain?: string | null;
}

async function getBrands(): Promise<{
  brands: Brand[];
  error: string | null;
}> {
  if (!getBackendUrl()) {
    return {
      brands: [],
      error:
        "BACKEND_URL is not configured, so the product service cannot be reached.",
    };
  }

  try {
    const response = await backendFetch("/api/brands?includeInactive=true&withCounts=true");

    if (!response.ok) {
      return {
        brands: [],
        error: `The product service answered ${response.status}.`,
      };
    }

    const body = (await response.json()) as { brands?: Brand[] };

    return { brands: body.brands ?? [], error: null };
  } catch (error) {
    console.error("Brand list failed:", error);

    return { brands: [], error: "The product service could not be reached." };
  }
}

export default async function BrandsPage() {
  const admin = await requireAdmin();
  const { brands, error } = await getBrands();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <AdminNav adminEmail={admin.email} active="brands" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-bold">Brands</h1>

        <p className="mt-2 text-sm text-neutral-500">
          {brands.length} tracked. Collection searches every store for
          these brands in both markets.
        </p>

        {error ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          <BrandBar />
        </div>

        {brands.length > 0 ? (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Sale items</th>
                  <th className="px-4 py-3">Own shop</th>
                  <th className="px-4 py-3">Korean</th>
                  <th className="px-4 py-3">Also matched as</th>
                  <th className="px-4 py-3">Added by</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>

              <tbody>
                {brands.map((brand) => (
                  <tr
                    key={brand.slug}
                    className="border-b border-neutral-100 align-top last:border-b-0"
                  >
                    <td className="px-4 py-4">
                      <Link
                        href={`/brands/${brand.slug}`}
                        className="font-semibold underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-950"
                      >
                        {brand.englishName}
                      </Link>

                      <p className="font-mono text-xs text-neutral-400">
                        {brand.slug}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      {brand.productCount ? (
                        <>
                          <span className="font-semibold">
                            {brand.productCount}
                          </span>

                          {/*
                            Which storefront they are in. A brand on sale
                            only in America shows nothing on the Korean
                            store, which the total alone does not explain.
                          */}
                          {brand.productCountByMarket ? (
                            <span className="mt-0.5 block text-xs text-neutral-500">
                              US {brand.productCountByMarket.US} · KR{" "}
                              {brand.productCountByMarket.KR} · JP{" "}
                              {brand.productCountByMarket.JP ?? 0}
                            </span>
                          ) : null}
                        </>
                      ) : brand.productCount === 0 ? (
                        <span
                          className="text-xs text-amber-700"
                          title="The brand is tracked, but nothing from it is on sale right now at its own website or at the sale sites we search."
                        >
                          none on sale
                        </span>
                      ) : (
                        <span
                          className="text-xs text-neutral-400"
                          title="The count could not be read just now. This does not mean the brand has nothing on sale."
                        >
                          not counted
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-xs">
                      {brand.storeDomain ? (
                        <a
                          href={`https://${brand.storeDomain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-neutral-600 underline underline-offset-2 hover:text-neutral-950"
                        >
                          {brand.storeDomain}
                        </a>
                      ) : (
                        <span
                          className="text-neutral-400"
                          title="No shop of the brand's own was found, so its sale items come from the retailers only."
                        >
                          —
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-neutral-600">
                      {brand.koreanName ?? "—"}
                    </td>

                    <td className="px-4 py-4 text-xs text-neutral-500">
                      {brand.aliases.join(", ") || "—"}
                    </td>

                    <td className="px-4 py-4 text-xs text-neutral-500">
                      {brand.addedBy ?? "—"}
                    </td>

                    <td className="px-4 py-4">
                      <BrandRow
                        slug={brand.slug}
                        englishName={brand.englishName}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}
