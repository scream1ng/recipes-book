import Link from "next/link";
import { getPantryIngredients } from "@/lib/actions/catalog";
import { getSettings } from "@/lib/actions/settings";
import { selectBulkRefreshTargets } from "@/lib/pricing/bulkRefresh";
import { NavBar } from "@/components/ui/NavBar";
import { ListGroup, ListRow, ListDivider } from "@/components/ui/ListGroup";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PantryRow } from "@/components/pantry/PantryRow";
import { BulkRefreshBar } from "@/components/pantry/BulkRefreshBar";
import { Icon } from "@/components/ui/Icon";

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
  const eligibleCount = selectBulkRefreshTargets(
    Object.values(grouped).flat(),
    settings.stalePriceHours
  ).length;

  return (
    <>
      <NavBar title="Ingredients" />
      <BulkRefreshBar eligibleCount={eligibleCount} />

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
                <h2 className="text-[13px] font-semibold text-(--color-ink-muted)">
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

      <SectionHeader>More</SectionHeader>
      <ListGroup>
        <Link href="/settings">
          <ListRow interactive>
            <span className="flex-1">Settings</span>
            <Icon name="chevron-right" size={16} className="text-(--color-ink-muted)" />
          </ListRow>
        </Link>
      </ListGroup>
    </>
  );
}
