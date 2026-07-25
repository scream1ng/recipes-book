CREATE INDEX IF NOT EXISTS "CatalogIngredient_name_trgm_idx"
  ON "CatalogIngredient" USING GIN ("name" gin_trgm_ops);
