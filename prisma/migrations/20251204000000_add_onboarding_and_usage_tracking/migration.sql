-- AlterTable
ALTER TABLE "StoreInformation"
ADD COLUMN IF NOT EXISTS "pricingPlan" TEXT,
ADD COLUMN IF NOT EXISTS "questionMonthStart" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewSummariesGenerated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "reviewMonthStart" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "widgetInstalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "storeContextCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "setupCompletedAt" TIMESTAMP(3);

-- AlterTable (ensure monthlyQuestions has correct type)
ALTER TABLE "StoreInformation"
ALTER COLUMN "monthlyQuestions" SET DEFAULT 0,
ALTER COLUMN "monthlyQuestions" SET NOT NULL;

-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "ReviewSummaryCache" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "reviewHash" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewSummaryCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ReviewSummaryCache_shop_productId_key') THEN
        CREATE UNIQUE INDEX "ReviewSummaryCache_shop_productId_key" ON "ReviewSummaryCache"("shop", "productId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ReviewSummaryCache_shop_generatedAt_idx') THEN
        CREATE INDEX "ReviewSummaryCache_shop_generatedAt_idx" ON "ReviewSummaryCache"("shop", "generatedAt");
    END IF;
END $$;
