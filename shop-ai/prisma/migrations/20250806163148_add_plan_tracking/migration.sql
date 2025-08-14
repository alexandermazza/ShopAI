-- AlterTable
ALTER TABLE "StoreInformation" ADD COLUMN     "monthlyQuestions" INTEGER DEFAULT 0,
ADD COLUMN     "planLimits" JSONB,
ADD COLUMN     "planStartDate" TIMESTAMP(3),
ADD COLUMN     "pricingPlan" TEXT DEFAULT 'free',
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referrerPayoutId" TEXT;
