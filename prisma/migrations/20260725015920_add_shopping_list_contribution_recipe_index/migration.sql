-- DropIndex
DROP INDEX "CatalogIngredient_name_trgm_idx";

-- CreateIndex
CREATE INDEX "ShoppingListContribution_recipeId_idx" ON "ShoppingListContribution"("recipeId");
