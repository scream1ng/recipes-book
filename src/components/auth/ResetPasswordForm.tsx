"use client";

import { useActionState } from "react";
import { resetPasswordAction, type AuthFormState } from "@/lib/actions/credentials";

const initialState: AuthFormState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3 text-left">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm">
        New password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-lg border border-(--color-border) px-3 py-2 text-base"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirm password
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-lg border border-(--color-border) px-3 py-2 text-base"
        />
      </label>

      {state.error && <p className="text-sm text-(--color-accent-dark)">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="mt-1 rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white shadow-sm hover:bg-(--color-accent-dark) disabled:opacity-40"
      >
        {isPending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
