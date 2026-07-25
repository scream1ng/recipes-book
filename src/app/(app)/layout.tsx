import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BottomNav } from "@/components/ui/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-4 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
