-- DropIndex
DROP INDEX "CatalogIngredient_name_trgm_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password" TEXT;
