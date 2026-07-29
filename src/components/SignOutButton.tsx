"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/signin" })}
      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-900 hover:text-white"
    >
      Sign out
    </button>
  );
}
