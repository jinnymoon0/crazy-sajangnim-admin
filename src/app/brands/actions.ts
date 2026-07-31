"use server";

import { revalidatePath } from "next/cache";

import { backendFetch } from "@/lib/backend";
import { requireAdmin } from "@/lib/require-admin";

export interface BrandCandidate {
  englishName: string;
  koreanName: string | null;
  aliases: string[];
  confidence: number;
  slug: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
}

export interface BrandActionResult {
  ok: boolean;
  message: string;
  /** Present when the name needs resolving before it can be added. */
  candidates?: BrandCandidate[];
}

function errorMessage(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }

  return fallback;
}

/*
 * Latin letters mean retailers can be searched for this name directly.
 * Anything else has to be resolved to an English name first.
 */
function isLatinName(value: string): boolean {
  return /^[\p{Script=Latin}\p{M}0-9&'’.\-\s+]+$/u.test(value.trim());
}

/*
 * Add a brand typed into the admin bar. An English name is added
 * straight away; any other language is looked up on the web and the
 * matches are returned for the admin to choose from.
 */
export async function submitBrand(
  formData: FormData,
): Promise<BrandActionResult> {
  const admin = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { ok: false, message: "Please enter a brand name." };
  }

  if (!isLatinName(name)) {
    try {
      const response = await backendFetch(
        `/api/brands/search?q=${encodeURIComponent(name)}`,
      );

      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          ok: false,
          message: errorMessage(body, "The brand search failed."),
        };
      }

      const candidates =
        (body as { candidates?: BrandCandidate[] }).candidates ?? [];

      if (candidates.length === 0) {
        return {
          ok: false,
          message: `No brands found for “${name}”. Try the English spelling.`,
        };
      }

      return {
        ok: true,
        message: `Select the brand that matches “${name}”.`,
        candidates,
      };
    } catch (error) {
      console.error("Brand search failed:", error);

      return { ok: false, message: "The brand search could not be reached." };
    }
  }

  return addBrand({ englishName: name, addedBy: admin.email });
}

export async function addBrand(input: {
  englishName: string;
  koreanName?: string | null;
  aliases?: string[];
  slug?: string;
  addedBy?: string;
}): Promise<BrandActionResult> {
  const admin = await requireAdmin();

  try {
    const response = await backendFetch("/api/brands", {
      method: "POST",
      body: JSON.stringify({
        englishName: input.englishName,
        koreanName: input.koreanName ?? null,
        aliases: input.aliases ?? [],
        slug: input.slug,
        addedBy: input.addedBy ?? admin.email,
      }),
    });

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        message: errorMessage(body, "Failed to add the brand."),
      };
    }

    revalidatePath("/brands");

    return {
      ok: true,
      message: `${input.englishName.toUpperCase()} is now tracked for the US and Korean stores. It will appear in the catalog after the next collection run.`,
    };
  } catch (error) {
    console.error("Brand add failed:", error);

    return { ok: false, message: "The product service could not be reached." };
  }
}

export async function removeBrand(slug: string): Promise<BrandActionResult> {
  await requireAdmin();

  try {
    const response = await backendFetch(
      `/api/brands/${encodeURIComponent(slug)}`,
      { method: "DELETE" },
    );

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        message: errorMessage(body, "Failed to remove the brand."),
      };
    }

    revalidatePath("/brands");

    return { ok: true, message: `Stopped tracking ${slug}.` };
  } catch (error) {
    console.error("Brand removal failed:", error);

    return { ok: false, message: "The product service could not be reached." };
  }
}
