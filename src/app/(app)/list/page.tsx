import { getShoppingList, clearCheckedItems } from "@/lib/actions/list";
import { centsToDisplay } from "@/lib/money";
import { ListItemRow } from "@/components/list/ListItemRow";

const CATEGORY_LABELS: Record<string, string> = {
  MEAT_POULTRY: "Meat & Poultry",
  PRODUCE: "Produce",
  PANTRY: "Pantry",
  DAIRY_EGGS: "Dairy & Eggs",
  FROZEN: "Frozen",
  BAKERY: "Bakery",
  OTHER: "Other",
};

export default async function ShoppingListPage() {
  const { grouped, basketTotalCents, leftToBuyTotalCents } = await getShoppingList();
  const categories = Object.keys(grouped);

  async function handleClearChecked() {
    "use server";
    await clearCheckedItems();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-serif-heading text-3xl">Shopping list</h1>
        <form action={handleClearChecked}>
          <button type="submit" className="text-sm text-(--color-ink-muted) underline">
            Clear checked
          </button>
        </form>
      </div>

      {categories.length === 0 ? (
        <p className="mt-12 text-center text-(--color-ink-muted)">
          Your list is empty. Add a recipe from the Library to get started.
        </p>
      ) : (
        categories.map((category) => {
          const rows = grouped[category];
          const subtotal = rows.reduce((sum, r) => sum + r.totalCents, 0);
          return (
            <div key={category} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm font-medium text-(--color-ink-muted)">
                <span>{CATEGORY_LABELS[category] ?? category}</span>
                <span>{centsToDisplay(subtotal)}</span>
              </div>
              <ul className="flex flex-col gap-2">
                {rows.map((row) => (
                  <ListItemRow key={row.id} row={row} />
                ))}
              </ul>
            </div>
          );
        })
      )}

      <div className="rounded-2xl border border-(--color-border) bg-(--color-surface-alt) p-4">
        <div className="flex items-center justify-between">
          <span className="text-(--color-ink-muted)">Basket total</span>
          <span className="text-lg font-semibold">{centsToDisplay(basketTotalCents)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-(--color-ink-muted)">Left to buy</span>
          <span>{centsToDisplay(leftToBuyTotalCents)}</span>
        </div>
      </div>
    </div>
  );
}
