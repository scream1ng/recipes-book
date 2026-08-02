import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TabBar } from "@/components/ui/TabBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <div className="flex min-h-screen flex-col">
      <main
        className="mx-auto w-full max-w-lg flex-1 px-4"
        style={{
          paddingTop: "calc(1.5rem + env(safe-area-inset-top))",
          paddingBottom: "calc(1rem + var(--tabbar-total))",
        }}
      >
        {children}
      </main>
      <TabBar />
    </div>
  );
}
