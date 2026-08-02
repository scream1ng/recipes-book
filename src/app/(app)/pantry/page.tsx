import Link from "next/link";
import { getPantryIngredients } from "@/lib/actions/catalog";
import { getSettings } from "@/lib/actions/settings";
import { NavBar } from "@/components/ui/NavBar";
import { ListGroup, ListDivider } from "@/components/ui/ListGroup";
import { PantryRow } from "@/components/pantry/PantryRow";

const CATEGORY_LABELS: Record<string, string> = {
  MEAT_POULTRY: "Meat & Poultry",
  PRODUCE: "Produce",
  PANTRY: "Pantry",
  DAIRY_EGGS: "Dairy & Eggs",
  FROZEN: "Frozen",
  BAKERY: "Bakery",
  OTHER: "Other",
};

export default async function PantryPage() {
  const [grouped, settings] = await Promise.all([getPantryIngredients(), getSettings()]);
  const categories = Object.keys(grouped);

  return (
    <>
      <div className="-mx-4" style={{ marginTop: "calc(-1.5rem - env(safe-area-inset-top))" }}>
        <NavBar
          title="Ingredients"
          right={
            <Link href="/settings" className="text-[15px] text-(--color-accent)">
              Settings
            </Link>
          }
        />
      </div>

      {categories.length === 0 ? (
        <p className="mt-12 text-center text-(--color-ink-muted)">
          No ingredients yet. They&apos;ll show up here once your recipes have priced ingredients.
        </p>
      ) : (
        categories.map((category) => {
          const rows = grouped[category];
          const onHandCount = rows.filter((r) => r.onHand).length;
          return (
            <div key={category}>
              <div className="flex items-center justify-between pl-4 pt-6 pb-[7px]">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">
                  {CATEGORY_LABELS[category] ?? category}
                </h2>
                <span className="pr-4 text-xs text-(--color-ink-muted)">
                  {onHandCount}/{rows.length} on hand
                </span>
              </div>
              <ListGroup>
                {rows.map((row, i) => (
                  <div key={row.id}>
                    {i > 0 && <ListDivider />}
                    <PantryRow ingredient={row} stalePriceHours={settings.stalePriceHours} />
                  </div>
                ))}
              </ListGroup>
            </div>
          );
        })
      )}
    </>
  );
}
