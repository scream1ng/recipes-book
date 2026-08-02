"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, type AuthFormState } from "@/lib/actions/credentials";

const initialState: AuthFormState = {};

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3 text-left">
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
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-lg border border-(--color-border) px-3 py-2 text-base"
        />
      </label>

      {state.error && <p className="text-sm text-(--color-accent-dark)">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white shadow-sm hover:bg-(--color-accent-dark) disabled:opacity-60"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-(--color-ink-muted)">
        No account yet?{" "}
        <Link href="/signup" className="font-medium text-(--color-accent-dark)">
          Sign up
        </Link>
      </p>
    </form>
  );
}
