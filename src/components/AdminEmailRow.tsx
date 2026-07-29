"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { removeAdminEmail } from "@/app/actions";

interface AdminEmailRowProps {
  email: string;
  isSelf: boolean;
}

export default function AdminEmailRow({ email, isSelf }: AdminEmailRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    if (
      !window.confirm(
        `Remove admin access for ${email}? They will no longer be able to sign in.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await removeAdminEmail(email);

      if (!result.ok) {
        setError(result.message);

        return;
      }

      router.refresh();
    });
  }

  if (isSelf) {
    return <span className="text-xs text-neutral-400">You</span>;
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
