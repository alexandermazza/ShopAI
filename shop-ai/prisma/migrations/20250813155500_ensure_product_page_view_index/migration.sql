-- Ensure index exists for ProductPageView queries by (shop, viewedAt)
CREATE INDEX IF NOT EXISTS "ProductPageView_shop_viewedAt_idx" ON "public"."ProductPageView"("shop", "viewedAt");



