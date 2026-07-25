-- CreateEnum
CREATE TYPE "StorePreference" AS ENUM ('COLES', 'WOOLWORTHS', 'CHEAPEST_OF_BOTH');

-- CreateEnum
CREATE TYPE "IngredientCategory" AS ENUM ('MEAT_POULTRY', 'PRODUCE', 'PANTRY', 'DAIRY_EGGS', 'FROZEN', 'BAKERY', 'OTHER');

-- CreateEnum
CREATE TYPE "CanonicalUnit" AS ENUM ('MASS_G', 'VOLUME_ML', 'COUNT');

-- CreateEnum
CREATE TYPE "Store" AS ENUM ('COLES', 'WOOLWORTHS');

-- CreateEnum
CREATE TYPE "ProductOptionSource" AS ENUM ('COLES_SCRAPE', 'MANUAL');

-- CreateEnum
CREATE TYPE "RecipeSourceType" AS ENUM ('SCAN', 'MANUAL');

-- CreateEnum
CREATE TYPE "GeminiUsageKind" AS ENUM ('RECIPE_PARSE', 'COLES_HTML_PARSE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storePreference" "StorePreference" NOT NULL DEFAULT 'CHEAPEST_OF_BOTH',
    "showUnitPrices" BOOLEAN NOT NULL DEFAULT true,
    "warnStalePrices" BOOLEAN NOT NULL DEFAULT true,
    "stalePriceHours" INTEGER NOT NULL DEFAULT 48,
    "roundUpPartPacks" BOOLEAN NOT NULL DEFAULT true,
    "keepOffline" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogIngredient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "category" "IngredientCategory" NOT NULL DEFAULT 'OTHER',
    "canonicalUnit" "CanonicalUnit" NOT NULL,
    "gramsPerCount" DOUBLE PRECISION,
    "mlPerCount" DOUBLE PRECISION,
    "gramsPerMl" DOUBLE PRECISION,
    "gramsPerBunch" DOUBLE PRECISION,
    "isPantryStaple" BOOLEAN NOT NULL DEFAULT false,
    "selectedProductOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" TEXT NOT NULL,
    "catalogIngredientId" TEXT NOT NULL,
    "store" "Store" NOT NULL,
    "productName" TEXT NOT NULL,
    "packLabel" TEXT NOT NULL,
    "packQty" DOUBLE PRECISION NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "source" "ProductOptionSource" NOT NULL,
    "sourceUrl" TEXT,
    "colesProductId" TEXT,
    "priceUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRefreshError" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "productOptionId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "minutes" INTEGER,
    "baseServes" INTEGER NOT NULL DEFAULT 4,
    "sourceType" "RecipeSourceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "catalogIngredientId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "rawText" TEXT,
    "rawAmount" DOUBLE PRECISION,
    "rawUnit" TEXT,
    "displayName" TEXT NOT NULL,
    "qtyCanonical" DOUBLE PRECISION,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "excludeFromCost" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingListItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "catalogIngredientId" TEXT,
    "manualLabel" TEXT,
    "qtyCanonical" DOUBLE PRECISION,
    "productOptionId" TEXT,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShoppingListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingListContribution" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "recipeId" TEXT,
    "recipeName" TEXT NOT NULL,
    "servesUsed" INTEGER NOT NULL,
    "qtyCanonical" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ShoppingListContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColesSearchCache" (
    "id" TEXT NOT NULL,
    "queryKey" TEXT NOT NULL,
    "resultsJson" TEXT NOT NULL,
    "rawHtmlHash" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColesSearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeminiUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "GeminiUsageKind" NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeminiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogIngredient_selectedProductOptionId_key" ON "CatalogIngredient"("selectedProductOptionId");

-- CreateIndex
CREATE INDEX "CatalogIngredient_userId_idx" ON "CatalogIngredient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogIngredient_userId_normalizedName_key" ON "CatalogIngredient"("userId", "normalizedName");

-- CreateIndex
CREATE INDEX "ProductOption_catalogIngredientId_idx" ON "ProductOption"("catalogIngredientId");

-- CreateIndex
CREATE INDEX "PriceSnapshot_productOptionId_idx" ON "PriceSnapshot"("productOptionId");

-- CreateIndex
CREATE INDEX "Recipe_userId_idx" ON "Recipe"("userId");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeId_idx" ON "RecipeIngredient"("recipeId");

-- CreateIndex
CREATE INDEX "ShoppingListItem_userId_idx" ON "ShoppingListItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingListItem_userId_catalogIngredientId_key" ON "ShoppingListItem"("userId", "catalogIngredientId");

-- CreateIndex
CREATE INDEX "ShoppingListContribution_itemId_idx" ON "ShoppingListContribution"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ColesSearchCache_queryKey_key" ON "ColesSearchCache"("queryKey");

-- CreateIndex
CREATE INDEX "GeminiUsageLog_userId_idx" ON "GeminiUsageLog"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogIngredient" ADD CONSTRAINT "CatalogIngredient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogIngredient" ADD CONSTRAINT "CatalogIngredient_selectedProductOptionId_fkey" FOREIGN KEY ("selectedProductOptionId") REFERENCES "ProductOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_catalogIngredientId_fkey" FOREIGN KEY ("catalogIngredientId") REFERENCES "CatalogIngredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_productOptionId_fkey" FOREIGN KEY ("productOptionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_catalogIngredientId_fkey" FOREIGN KEY ("catalogIngredientId") REFERENCES "CatalogIngredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_catalogIngredientId_fkey" FOREIGN KEY ("catalogIngredientId") REFERENCES "CatalogIngredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_productOptionId_fkey" FOREIGN KEY ("productOptionId") REFERENCES "ProductOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListContribution" ADD CONSTRAINT "ShoppingListContribution_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShoppingListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListContribution" ADD CONSTRAINT "ShoppingListContribution_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeminiUsageLog" ADD CONSTRAINT "GeminiUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
