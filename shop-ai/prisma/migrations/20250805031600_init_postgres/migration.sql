-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StoreInformation" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "storeName" TEXT,
    "storeDescription" TEXT,
    "shippingPolicy" TEXT,
    "returnPolicy" TEXT,
    "storeHours" TEXT,
    "contactInfo" TEXT,
    "specialServices" TEXT,
    "aboutUs" TEXT,
    "additionalInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInformation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerQuestion" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "times" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CustomerQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreInformation_shop_key" ON "public"."StoreInformation"("shop");

-- CreateIndex
CREATE INDEX "CustomerQuestion_shop_askedAt_idx" ON "public"."CustomerQuestion"("shop", "askedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerQuestion_shop_question_key" ON "public"."CustomerQuestion"("shop", "question");
