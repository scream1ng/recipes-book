import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { verifyResetToken } from "@/lib/actions/credentials";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/recipes");

  const { token } = await searchParams;
  const status = await verifyResetToken(token ?? "");

  if (status !== "valid") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-3xl text-(--color-accent)">This link has expired</h1>
        <p className="max-w-sm text-(--color-ink-muted)">
          Reset links are single-use and expire after 60 minutes. Request a new one to continue.
        </p>
        <Link
          href="/forgot-password"
          className="rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white shadow-sm hover:bg-(--color-accent-dark)"
        >
          Send a new link
        </Link>
        <Link href="/signin" className="text-sm font-medium text-(--color-accent-dark)">
          ← Back to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl text-(--color-accent)">Set a new password</h1>

      <ResetPasswordForm token={token as string} />
    </main>
  );
}
