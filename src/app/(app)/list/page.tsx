import { getShoppingList, clearCheckedItems } from "@/lib/actions/list";
import { centsToDisplay } from "@/lib/money";
import { ListItemRow } from "@/components/list/ListItemRow";
import { AddManualItem } from "@/components/list/AddManualItem";
import { NavBar } from "@/components/ui/NavBar";
import { BackLink } from "@/components/ui/BackLink";
import { ListGroup, ListDivider } from "@/components/ui/ListGroup";
import { SectionHeader } from "@/components/ui/SectionHeader";

const CATEGORY_LABELS: Record<string, string> = {
  MEAT_POULTRY: "Meat & Poultry",
  PRODUCE: "Produce",
  PANTRY: "Pantry",
  DAIRY_EGGS: "Dairy & Eggs",
  FROZEN: "Frozen",
  BAKERY: "Bakery",
  OTHER: "Other",
  MANUAL: "Manual items",
};

export default async function ShoppingListPage() {
  const { grouped, basketTotalCents, leftToBuyTotalCents } = await getShoppingList();
  const categories = Object.keys(grouped);

  async function handleClearChecked() {
    "use server";
    await clearCheckedItems();
  }

  return (
    <>
      <NavBar
        title="Shopping list"
        left={<BackLink href="/order" label="Order" />}
        right={
          <form action={handleClearChecked}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center text-[15px] text-(--color-accent) active:opacity-60"
            >
              Clear
            </button>
          </form>
        }
      />

      <AddManualItem />

      {categories.length === 0 ? (
        <p className="mt-12 text-center text-(--color-ink-muted)">
          Your list is empty. Set an order quantity on a recipe to get started.
        </p>
      ) : (
        categories.map((category) => {
          const rows = grouped[category];
          const subtotal = rows.reduce((sum, r) => sum + r.totalCents, 0);
          return (
            <div key={category}>
              <div className="flex items-center justify-between pl-4 pt-6 pb-[7px]">
                <h2 className="text-[13px] font-semibold text-(--color-ink-muted)">
                  {CATEGORY_LABELS[category] ?? category}
                </h2>
                <span className="tabular-nums pr-4 text-xs text-(--color-ink-muted)">
                  {centsToDisplay(subtotal)}
                </span>
              </div>
              <ListGroup>
                {rows.map((row, i) => (
                  <div key={row.id}>
                    {i > 0 && <ListDivider />}
                    <ListItemRow row={row} />
                  </div>
                ))}
              </ListGroup>
            </div>
          );
        })
      )}

      <SectionHeader>Total</SectionHeader>
      <ListGroup>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-(--color-ink-muted)">Basket total</span>
          <span className="tabular-nums text-lg font-semibold">
            {centsToDisplay(basketTotalCents)}
          </span>
        </div>
        <ListDivider />
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-(--color-ink-muted)">Left to buy</span>
          <span className="tabular-nums">{centsToDisplay(leftToBuyTotalCents)}</span>
        </div>
      </ListGroup>
    </>
  );
}
