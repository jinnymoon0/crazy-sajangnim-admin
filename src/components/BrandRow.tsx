"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { removeBrand } from "@/app/brands/actions";

interface BrandRowProps {
  slug: string;
  englishName: string;
}

export default function BrandRow({ slug, englishName }: BrandRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    if (
      !window.confirm(
        `Stop tracking ${englishName}? Products already collected stay in the catalog.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const outcome = await removeBrand(slug);

      if (!outcome.ok) {
        setError(outcome.message);

        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
      >
        Remove
      </button>

      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
