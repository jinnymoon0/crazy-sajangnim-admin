"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function GoogleSignInButton() {
  const [isPending, setIsPending] = useState(false);

  function handleSignIn() {
    setIsPending(true);
    void signIn("google", { callbackUrl: "/" });
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      disabled={isPending}
      className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-neutral-300 bg-white px-5 text-sm font-semibold transition hover:bg-neutral-100 disabled:opacity-60"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
        <path
          fill="#4285F4"
          d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.8c2.2-2 3.7-5 3.7-8.5z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.8c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 2.9C3.3 21.3 7.3 24 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.2 14.5c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2L1.3 7.2C.5 8.7 0 10.3 0 12.3s.5 3.6 1.3 5.1l3.9-2.9z"
        />
        <path
          fill="#EA4335"
          d="M12 4.8c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.3 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3C6.1 6.9 8.8 4.8 12 4.8z"
        />
      </svg>
      {isPending ? "Redirecting..." : "Sign in with Google"}
    </button>
  );
}
