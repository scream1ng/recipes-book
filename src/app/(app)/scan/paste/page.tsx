import { PasteEntry } from "@/components/scan/PasteEntry";
import { NavBar } from "@/components/ui/NavBar";
import { BackLink } from "@/components/ui/BackLink";

const ORIGINS: Record<string, { href: string; label: string }> = {
  recipes: { href: "/recipes", label: "Recipes" },
  order: { href: "/order", label: "Order" },
};

export default async function PasteRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const origin = (from && ORIGINS[from]) || { href: "/scan", label: "Scan" };

  return (
    <>
      <NavBar title="Paste a recipe" left={<BackLink href={origin.href} label={origin.label} />} />
      <PasteEntry />
    </>
  );
}
