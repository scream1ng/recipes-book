import Link from "next/link";
import { listRecipes } from "@/lib/actions/recipes";
import { getOrder, clearOrder } from "@/lib/actions/order";
import { centsToDisplay } from "@/lib/money";
import { NavBar } from "@/components/ui/NavBar";
import { ListGroup, ListRow, ListDivider } from "@/components/ui/ListGroup";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { OrderStepper } from "@/components/order/OrderStepper";
import { Icon } from "@/components/ui/Icon";

export default async function OrderPage() {
  const [recipes, order] = await Promise.all([listRecipes(), getOrder()]);

  async function handleClear() {
    "use server";
    await clearOrder();
  }

  return (
    <>
      <NavBar
        title="Order"
        right={
          recipes.length > 0 ? (
            <form action={handleClear}>
              <button type="submit" className="text-[15px] text-(--color-accent) active:opacity-60">
                Clear order
              </button>
            </form>
          ) : undefined
        }
      />

      {recipes.length === 0 ? (
        <p className="mt-12 text-center text-(--color-ink-muted)">
          No recipes yet. Scan a photo or paste one in to get started.
        </p>
      ) : (
        <>
          <SectionHeader>Recipes</SectionHeader>
          <ListGroup>
            {recipes.map((recipe, i) => (
              <div key={recipe.id}>
                {i > 0 && <ListDivider inset={0} />}
                <ListRow>
                  <div className="min-w-0 flex-1">
                    <p className="recipe-name truncate text-lg">{recipe.name}</p>
                    <p className="tabular-nums text-xs text-(--color-ink-muted)">
                      {centsToDisplay(recipe.costPerServeCents)}/serve
                    </p>
                  </div>
                  <OrderStepper recipeId={recipe.id} qty={recipe.orderQty} />
                </ListRow>
              </div>
            ))}
          </ListGroup>
        </>
      )}

      <SectionHeader>Pantry</SectionHeader>
      <ListGroup>
        <Link href="/pantry">
          <ListRow interactive>
            <span className="flex-1">Pantry &amp; staples</span>
            <Icon name="chevron-right" size={16} className="text-(--color-ink-muted)" />
          </ListRow>
        </Link>
      </ListGroup>

      {recipes.length > 0 ? (
        <StickyActionBar>
          <div className="flex flex-1 flex-col justify-center text-sm">
            <span className="font-semibold">
              {order.cakeCount === 0
                ? "Nothing on the order yet"
                : `${order.cakeCount} ${order.cakeCount === 1 ? "cake" : "cakes"} to bake`}
            </span>
            <span className="tabular-nums text-(--color-ink-muted)">
              {centsToDisplay(order.aggregateCents)}
            </span>
          </div>
          <Link
            href={order.recipeCount > 0 ? "/list" : "#"}
            aria-disabled={order.recipeCount === 0}
            className={`flex-1 rounded-full px-4 py-2.5 text-center text-sm font-medium ${
              order.recipeCount === 0
                ? "pointer-events-none bg-(--color-surface-alt) text-(--color-ink-muted)"
                : "bg-(--color-accent) text-white"
            }`}
          >
            Ingredient list
          </Link>
        </StickyActionBar>
      ) : (
        <StickyActionBar>
          <Link
            href="/scan"
            className="flex-1 rounded-full bg-(--color-accent) px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            + Scan
          </Link>
          <Link
            href="/scan/paste?from=order"
            className="flex-1 rounded-full border border-(--color-border) px-4 py-2.5 text-center text-sm font-medium text-(--color-ink)"
          >
            + Paste
          </Link>
        </StickyActionBar>
      )}
    </>
  );
}
