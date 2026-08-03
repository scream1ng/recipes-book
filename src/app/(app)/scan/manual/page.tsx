import { ManualEntry } from "@/components/scan/ManualEntry";
import { NavBar } from "@/components/ui/NavBar";
import { BackLink } from "@/components/ui/BackLink";

const ORIGINS: Record<string, { href: string; label: string }> = {
  recipes: { href: "/recipes", label: "Recipes" },
  order: { href: "/order", label: "Order" },
};

export default async function ManualEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const origin = (from && ORIGINS[from]) || { href: "/scan", label: "Scan" };

  return (
    <>
      <NavBar title="Manual entry" left={<BackLink href={origin.href} label={origin.label} />} />
      <div className="flex flex-col gap-4 pt-6">
        <ManualEntry />
      </div>
    </>
  );
}
