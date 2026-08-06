import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) redirect("/recipes");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl text-(--color-accent)">Reset your password</h1>

      <ForgotPasswordForm />
    </main>
  );
}
