import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCachedColesResults } from "@/lib/scrape/coles-cache";
import { isPriceStale } from "@/lib/pricing/staleness";
import { checkColesSearchRateLimit } from "@/lib/ratelimit";

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const catalogIngredientId = searchParams.get("catalogIngredientId");
  if (!catalogIngredientId) {
    return NextResponse.json({ error: "catalogIngredientId is required" }, { status: 400 });
  }

  if (!checkColesSearchRateLimit(userId)) {
    return NextResponse.json({ error: "Too many requests — try again in a moment." }, { status: 429 });
  }

  const [catalogIngredient, settings] = await Promise.all([
    prisma.catalogIngredient.findFirst({
      where: { id: catalogIngredientId, userId },
      include: { productOptions: { where: { isArchived: false } } },
    }),
    prisma.userSettings.findUniqueOrThrow({ where: { userId } }),
  ]);

  if (!catalogIngredient) {
    return NextResponse.json({ error: "Catalog ingredient not found" }, { status: 404 });
  }

  const stored = catalogIngredient.productOptions.map((option) => ({
    id: option.id,
    store: option.store,
    productName: option.productName,
    packLabel: option.packLabel,
    packQty: option.packQty,
    priceCents: option.priceCents,
    source: option.source,
    priceUpdatedAt: option.priceUpdatedAt,
    isCurrent: option.id === catalogIngredient.selectedProductOptionId,
    isStale: isPriceStale(option.priceUpdatedAt, settings.stalePriceHours),
    lastRefreshError: option.lastRefreshError,
    lowConfidence: option.lowConfidence,
  }));

  // Live Coles query (via the shared 24h cache) supplements the stored options.
  const { products: liveColes } = await getCachedColesResults(userId, catalogIngredient.name, {
    priority: "interactive",
  });

  return NextResponse.json({ stored, liveColes });
}
