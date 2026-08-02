import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/SignUpForm";

export default async function SignUpPage() {
  const session = await auth();
  if (session?.user) redirect("/recipes");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl text-(--color-accent)">Recipes Book</h1>
      <p className="max-w-sm text-(--color-ink-muted)">
        Create an account to start pricing your recipes.
      </p>

      <SignUpForm />
    </main>
  );
}
