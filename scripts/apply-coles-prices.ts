/**
 * Writes Coles prices picked by hand (or by Claude browsing coles.com.au) into
 * prod, for ingredients listed by list-price-targets.ts — see that file for
 * why this isn't scraped automatically anymore.
 *
 * Input is a JSON array of picks, one per grouped ingredient (matches
 * list-price-targets.ts's grouped output) — one product, fanned out to every
 * account that needed it:
 *   {
 *     query, productName, packLabel, packQty, priceCents,
 *     colesProductId?, sourceUrl?, lowConfidence?,
 *     targets: [
 *       { userEmail, kind: "discover", catalogIngredientId } |
 *       { userEmail, kind: "refresh", productOptionId }
 *     ]
 *   }
 * Skip a query entirely (don't include it) rather than forcing a bad pick —
 * same judgment call as any single-account run (see glucose: only real
 * candidate unavailable, other candidate is the wrong product).
 *
 * Usage: npm run apply-coles-prices <picks.json>
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { addColesProductAsOptionCore } from "../src/lib/pricing/colesWrite";

const prisma = new PrismaClient();

interface Target {
  userEmail: string;
  kind: "discover" | "refresh";
  catalogIngredientId?: string;
  productOptionId?: string;
}

interface Pick {
  query: string;
  productName: string;
  packLabel: string;
  packQty: number;
  priceCents: number;
  colesProductId?: string | null;
  sourceUrl?: string | null;
  lowConfidence?: boolean;
  targets: Target[];
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run apply-coles-prices <picks.json>");
    process.exit(1);
  }

  const picks: Pick[] = JSON.parse(readFileSync(filePath, "utf-8"));

  const userIdByEmail = new Map<string, string>();
  async function resolveUserId(email: string): Promise<string> {
    const cached = userIdByEmail.get(email);
    if (cached) return cached;
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    userIdByEmail.set(email, user.id);
    return user.id;
  }

  let discovered = 0;
  let updated = 0;
  let failed = 0;

  for (const pick of picks) {
    if (pick.packQty <= 0) {
      failed += pick.targets.length;
      console.log(`${pick.query}: failed for all targets — packQty must be positive`);
      continue;
    }

    for (const target of pick.targets) {
      try {
        const userId = await resolveUserId(target.userEmail);

        if (target.kind === "discover") {
          if (!target.catalogIngredientId) throw new Error("catalogIngredientId missing for discover target");
          await addColesProductAsOptionCore(
            userId,
            {
              catalogIngredientId: target.catalogIngredientId,
              productName: pick.productName,
              packLabel: pick.packLabel,
              packQty: pick.packQty,
              priceCents: pick.priceCents,
              colesProductId: pick.colesProductId ?? null,
              sourceUrl: pick.sourceUrl ?? null,
              lowConfidence: pick.lowConfidence ?? false,
            },
            { revalidate: false }
          );
          discovered++;
          console.log(`discovered ${pick.productName} (${target.userEmail})`);
          continue;
        }

        if (!target.productOptionId) throw new Error("productOptionId missing for refresh target");
        const option = await prisma.productOption.findFirst({
          where: { id: target.productOptionId, catalogIngredient: { userId } },
        });
        if (!option) throw new Error("Product option not found");

        await prisma.productOption.update({
          where: { id: option.id },
          data: {
            productName: pick.productName,
            packLabel: pick.packLabel,
            packQty: pick.packQty,
            priceCents: pick.priceCents,
            priceUpdatedAt: new Date(),
            lastRefreshError: null,
            colesProductId: pick.colesProductId ?? option.colesProductId,
            sourceUrl: pick.sourceUrl ?? option.sourceUrl,
            lowConfidence: pick.lowConfidence ?? option.lowConfidence,
          },
        });
        await prisma.priceSnapshot.create({
          data: { productOptionId: option.id, priceCents: pick.priceCents },
        });
        updated++;
        console.log(`updated ${pick.productName} (${target.userEmail})`);
      } catch (err) {
        failed++;
        console.log(`${pick.query} (${target.userEmail}): failed — ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  console.log(`\nDiscovered ${discovered} · Updated ${updated} · Failed ${failed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
