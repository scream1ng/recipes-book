import { auth, googleConfigured, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/recipes");

  const { reset } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl text-(--color-accent)">Recipes Book</h1>
      <p className="max-w-sm text-(--color-ink-muted)">
        Your recipe book and grocery cost calculator.
      </p>

      {reset === "1" && (
        <p className="max-w-sm rounded-lg bg-(--color-good)/15 px-4 py-2 text-sm text-(--color-good)">
          Password updated — sign in with your new password.
        </p>
      )}

      <SignInForm />

      {googleConfigured && (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/recipes" });
          }}
        >
          <button
            type="submit"
            className="rounded-full border border-(--color-border) px-6 py-3 font-medium text-(--color-ink)"
          >
            Sign in with Google
          </button>
        </form>
      )}
    </main>
  );
}
