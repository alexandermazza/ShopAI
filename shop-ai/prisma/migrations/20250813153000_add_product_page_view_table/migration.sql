-- CreateTable: ProductPageView (idempotent)
CREATE TABLE IF NOT EXISTS "public"."ProductPageView" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "ProductPageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for efficient range queries by shop/date (idempotent)
CREATE INDEX IF NOT EXISTS "ProductPageView_shop_viewedAt_idx" ON "public"."ProductPageView"("shop", "viewedAt");


