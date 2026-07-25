import { redirect } from "next/navigation";
import { auth, authConfigured } from "@/lib/auth";

export default async function RootPage() {
  if (!authConfigured) {
    redirect("/signin");
  }
  const session = await auth();
  redirect(session?.user ? "/recipes" : "/signin");
}
