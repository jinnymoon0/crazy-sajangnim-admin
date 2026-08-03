"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setMessageRead } from "@/app/messages/actions";

interface MessageReadToggleProps {
  id: string;
  isRead: boolean;
}

export default function MessageReadToggle({
  id,
  isRead,
}: MessageReadToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      const outcome = await setMessageRead(id, !isRead);

      if (!outcome.ok) {
        setError(outcome.message);

        return;
      }

      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-xs text-red-600">{error}</span> : null}

      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-900 hover:text-white disabled:opacity-50"
      >
        {isRead ? "Mark unread" : "Mark read"}
      </button>
    </div>
  );
}
