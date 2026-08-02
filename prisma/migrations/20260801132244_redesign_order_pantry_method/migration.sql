-- AlterTable
ALTER TABLE "CatalogIngredient" ADD COLUMN     "onHand" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "bakeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastBakedAt" TIMESTAMP(3),
ADD COLUMN     "methodSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "orderQty" INTEGER NOT NULL DEFAULT 0;
