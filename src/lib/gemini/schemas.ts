import "server-only";
import { z } from "zod";

// ---- Recipe photo -> parsed ingredient lines (+ catalog matching) ----

export const catalogMatchSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    confidence: z.number().min(0).max(1),
  })
  .nullable();

export const parsedIngredientLineSchema = z.object({
  rawText: z.string(),
  amount: z.number().nullable(),
  unit: z.string().nullable(),
  name: z.string(),
  qtyCanonical: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  flagged: z.boolean(),
  note: z.string().nullable(),
  catalogMatch: catalogMatchSchema,
});

export const recipeParseResultSchema = z.object({
  recipeName: z.string().nullable(),
  minutes: z.number().nullable(),
  serves: z.number().nullable(),
  lines: z.array(parsedIngredientLineSchema),
});

export type RecipeParseResult = z.infer<typeof recipeParseResultSchema>;
export type ParsedIngredientLine = z.infer<typeof parsedIngredientLineSchema>;

// ---- Coles search HTML -> structured products ----

export const colesProductSchema = z.object({
  name: z.string(),
  packLabel: z.string(),
  packQty: z.number().positive().nullable(),
  priceCents: z.number().int().nullable(),
  productUrl: z.string().nullable(),
  productId: z.string().nullable(),
});

export const colesParseResultSchema = z.object({
  products: z.array(colesProductSchema),
});

export type ColesParseResult = z.infer<typeof colesParseResultSchema>;
export type ColesProduct = z.infer<typeof colesProductSchema>;
