"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { type ActionResult, deleteUser } from "@/app/actions";

interface UserActionsProps {
  userId: string;
  username: string;
}

export default function UserActions({ userId, username }: UserActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

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
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-600 hover:text-white disabled:opacity-50"
      >
        Delete
      </button>

      {result ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {result.message}
        </div>
      ) : null}
    </div>
  );
}
