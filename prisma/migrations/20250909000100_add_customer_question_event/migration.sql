-- CreateTable: CustomerQuestionEvent (idempotent)
CREATE TABLE IF NOT EXISTS "public"."CustomerQuestionEvent" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "questionRaw" TEXT NOT NULL,
    "questionNormalized" TEXT NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerQuestionEvent_pkey" PRIMARY KEY ("id")
);

-- Indexes for range queries and uniques (idempotent)
CREATE INDEX IF NOT EXISTS "CustomerQuestionEvent_shop_askedAt_idx" ON "public"."CustomerQuestionEvent"("shop", "askedAt");
CREATE INDEX IF NOT EXISTS "CustomerQuestionEvent_shop_questionNormalized_idx" ON "public"."CustomerQuestionEvent"("shop", "questionNormalized");





