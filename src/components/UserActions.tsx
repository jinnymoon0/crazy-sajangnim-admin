"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  type ActionResult,
  deleteUser,
  resetUserPassword,
} from "@/app/actions";

interface UserActionsProps {
  userId: string;
  username: string;
}

export default function UserActions({ userId, username }: UserActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function handleReset() {
    if (
      !window.confirm(
        `Reset the password for "${username}"? Their current password stops working immediately.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      setResult(await resetUserPassword(userId));
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Delete the account "${username}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const outcome = await deleteUser(userId);

      setResult(outcome.ok ? null : outcome);

      if (outcome.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={isPending}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-900 hover:text-white disabled:opacity-50"
        >
          Reset password
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {result ? (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            result.ok
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          <p>{result.message}</p>

          {result.temporaryPassword ? (
            <code className="mt-1 block select-all rounded bg-white px-2 py-1 font-mono text-sm">
              {result.temporaryPassword}
            </code>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
