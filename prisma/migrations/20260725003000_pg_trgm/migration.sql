-- Enables trigram similarity search used by lib/actions/catalog.ts (searchCatalog)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "CatalogIngredient_name_trgm_idx"
  ON "CatalogIngredient" USING GIN ("name" gin_trgm_ops);
