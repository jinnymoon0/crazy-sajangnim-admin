"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addBrand,
  collectBrand,
  submitBrand,
  type BrandActionResult,
  type BrandCandidate,
} from "@/app/brands/actions";

export default function BrandBar() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [result, setResult] = useState<BrandActionResult | null>(null);
  const [candidates, setCandidates] = useState<BrandCandidate[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);

  /*
   * Adding a brand is only half the job — its sale items have to be
   * collected before anything shows in the shop, so do that here
   * rather than leaving it until the nightly refresh.
   */
  async function collectAfterAdd(outcome: BrandActionResult) {
    setResult(outcome);

    if (!outcome.ok || !outcome.slug) {
      return;
    }

    setCandidates([]);
    setName("");
    setIsCollecting(true);

    try {
      const collected = await collectBrand(outcome.slug);

      setResult(collected);
    } finally {
      setIsCollecting(false);
      router.refresh();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const outcome = await submitBrand(formData);

      setCandidates(outcome.candidates ?? []);

      // Candidates came back, so the admin still has to choose one.
      if (outcome.candidates) {
        setResult(outcome);

        return;
      }

      await collectAfterAdd(outcome);
    });
  }

  function handleSelect(candidate: BrandCandidate) {
    startTransition(async () => {
      const outcome = await addBrand({
        englishName: candidate.englishName,
        koreanName: candidate.koreanName,
        aliases: candidate.aliases,
        slug: candidate.slug,
      });

      await collectAfterAdd(outcome);
    });
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-bold">Add a brand</h2>

      <p className="mt-1 text-sm text-neutral-500">
        Type a brand in any language. It is tracked for both the US and
        Korean stores, and its sale items are collected from the next run
        onwards.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap gap-3">
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Stone Island / 스톤아일랜드 / メゾン"
          required
          maxLength={80}
          className="min-w-64 flex-1 rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none transition focus:border-neutral-950"
        />

        <button
          type="submit"
          disabled={isPending || isCollecting}
          className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCollecting
            ? "Collecting sale items..."
            : isPending
              ? "Working..."
              : "Add brand"}
        </button>
      </form>

      {isCollecting ? (
        <p role="status" className="mt-3 text-sm text-neutral-600">
          Added. Searching the retailers for sale items — this takes about
          half a minute.
        </p>
      ) : result ? (
        <p
          role="status"
          className={`mt-3 text-sm ${
            result.ok ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {result.message}
        </p>
      ) : null}

      {candidates.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {candidates.map((candidate) => (
            <li
              key={candidate.slug}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold">{candidate.englishName}</p>

                {candidate.sourceTitle ? (
                  <p className="max-w-lg truncate text-xs text-neutral-400">
                    {candidate.sourceTitle}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => handleSelect(candidate)}
                disabled={isPending}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-900 hover:text-white disabled:opacity-50"
              >
                Add this one
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
