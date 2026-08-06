"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, type RequestResetState } from "@/lib/actions/credentials";

const initialState: RequestResetState = {};

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);

  if (state.sent) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
        <p className="text-(--color-ink)">
          If an account exists for that email, we&apos;ve sent a link to reset your password. It
          expires in 60 minutes.
        </p>
        <Link href="/signin" className="text-sm font-medium text-(--color-accent-dark)">
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3 text-left">
      <p className="text-center text-(--color-ink-muted)">
        Enter your account email and we&apos;ll send you a link to set a new password.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-lg border border-(--color-border) px-3 py-2 text-base"
        />
      </label>

      {state.error && <p className="text-sm text-(--color-accent-dark)">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white shadow-sm hover:bg-(--color-accent-dark) disabled:opacity-40"
      >
        {isPending ? "Sending…" : "Send reset link"}
      </button>

      <Link href="/signin" className="text-center text-sm font-medium text-(--color-accent-dark)">
        ← Back to sign in
      </Link>
    </form>
  );
}
