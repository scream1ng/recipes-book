import { auth, googleConfigured, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/SignInForm";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/recipes");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-serif-heading text-4xl text-(--color-accent)">Recipe Ledger</h1>
      <p className="max-w-sm text-(--color-ink-muted)">
        Your recipe book and grocery cost calculator.
      </p>

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
