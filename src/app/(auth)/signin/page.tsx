import { auth, authConfigured, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  if (authConfigured) {
    const session = await auth();
    if (session?.user) redirect("/recipes");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-serif-heading text-4xl text-(--color-accent)">Recipe Ledger</h1>
      <p className="max-w-sm text-(--color-ink-muted)">
        Your recipe book and grocery cost calculator.
      </p>

      {authConfigured ? (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/recipes" });
          }}
        >
          <button
            type="submit"
            className="rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white shadow-sm hover:bg-(--color-accent-dark)"
          >
            Sign in with Google
          </button>
        </form>
      ) : (
        <div className="max-w-md rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 text-left text-sm">
          <p className="font-medium text-(--color-accent-dark)">Google sign-in isn&apos;t configured yet.</p>
          <p className="mt-2 text-(--color-ink-muted)">
            Set <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> and{" "}
            <code>AUTH_SECRET</code> in your <code>.env</code> file (see <code>.env.example</code> and
            the README) and restart the dev server.
          </p>
        </div>
      )}
    </main>
  );
}
