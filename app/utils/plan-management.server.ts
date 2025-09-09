import { prisma } from "../db.server";

export interface PlanLimits {
  monthlyQuestions: number;
  features: string[];
  priority: "low" | "medium" | "high";
}

// Shopify plan names mapping - update these to match your actual Shopify app plans
export const SHOPIFY_PLAN_CONFIGS: Record<string, PlanLimits> = {
  "Free Plan": {
    monthlyQuestions: -1, // unlimited for now until usage-based pricing is implemented
    features: ["basic_chat", "question_tracking"],
    priority: "low"
  },
  "Pro Plan": {
    monthlyQuestions: -1, // unlimited for now until usage-based pricing is implemented
    features: ["basic_chat", "question_tracking", "analytics", "advanced_ai", "priority_support"],
    priority: "high"
  },
  // Add more actual Shopify plan names here as needed
};

// Default plan config for unknown plans
const DEFAULT_PLAN_CONFIG: PlanLimits = {
  monthlyQuestions: -1, // unlimited for now
  features: ["basic_chat", "question_tracking"],
  priority: "low"
};

/**
 * Set or update a store's pricing plan
 */
/**
 * Update referral code for a store (simplified for referral tracking only)
 */
export async function updateStoreReferralCode({
  shop,
  referralCode,
}: {
  shop: string;
  referralCode: string;
}) {
  // First, check if store info exists
  const existingStore = await prisma.storeInformation.findUnique({
    where: { shop }
  });

  if (existingStore) {
    // Update existing store
    return await prisma.storeInformation.update({
      where: { shop },
      data: {
        referralCode: referralCode,
      }
    });
  } else {
    // Create new store record with default plan
    return await prisma.storeInformation.create({
      data: {
        shop,
        pricingPlan: "Free Plan", // Default to free plan
        planStartDate: new Date(),
        referralCode,
        planLimits: DEFAULT_PLAN_CONFIG,
        monthlyQuestions: 0,
      }
    });
  }
}

/**
 * Update store plan (for future use when integrating with Shopify billing)
 */
export async function updateStorePlan({
  shop,
  plan,
  referralCode,
}: {
  shop: string;
  plan: string;
  referralCode?: string;
}) {
  const planLimits = SHOPIFY_PLAN_CONFIGS[plan] || DEFAULT_PLAN_CONFIG;

  // First, check if store info exists
  const existingStore = await prisma.storeInformation.findUnique({
    where: { shop }
  });

  if (existingStore) {
    // Update existing store
    return await prisma.storeInformation.update({
      where: { shop },
      data: {
        pricingPlan: plan,
        planStartDate: new Date(),
        referralCode: referralCode || existingStore.referralCode,
        planLimits: planLimits,
        monthlyQuestions: existingStore.monthlyQuestions || 0, // Keep existing usage
      }
    });
  } else {
    // Create new store record
    return await prisma.storeInformation.create({
      data: {
        shop,
        pricingPlan: plan,
        planStartDate: new Date(),
        referralCode,
        planLimits: planLimits,
        monthlyQuestions: 0,
      }
    });
  }
}

/**
 * Increment question count for a store and check limits
 */
export async function incrementQuestionCount(shop: string) {
  const storeInfo = await prisma.storeInformation.findUnique({
    where: { shop }
  });

  if (!storeInfo) {
    // Create default free plan if none exists
    await updateStorePlan({ shop, plan: "Free Plan" });
    return { allowed: true, remaining: -1 }; // Unlimited for now
  }

  const planLimits = SHOPIFY_PLAN_CONFIGS[storeInfo.pricingPlan || "Free Plan"] || DEFAULT_PLAN_CONFIG;
  const currentUsage = storeInfo.monthlyQuestions || 0;

  // For now, all plans are unlimited until usage-based pricing is implemented
  await prisma.storeInformation.update({
    where: { shop },
    data: { monthlyQuestions: currentUsage + 1 }
  });
  
  return { allowed: true, remaining: -1 }; // Unlimited for now

  // TODO: Re-enable this when usage-based pricing is implemented
  /*
  // Check if unlimited plan
  if (planLimits.monthlyQuestions === -1) {
    await prisma.storeInformation.update({
      where: { shop },
      data: { monthlyQuestions: currentUsage + 1 }
    });
    return { allowed: true, remaining: -1 };
  }

  // Check if within limits
  if (currentUsage >= planLimits.monthlyQuestions) {
    return { 
      allowed: false, 
      remaining: 0,
      message: `Monthly limit of ${planLimits.monthlyQuestions} questions reached. Please upgrade your plan.`
    };
  }

  // Increment usage
  await prisma.storeInformation.update({
    where: { shop },
    data: { monthlyQuestions: currentUsage + 1 }
  });

  return { 
    allowed: true, 
    remaining: planLimits.monthlyQuestions - (currentUsage + 1) 
  };
  */
}

/**
 * Reset monthly usage for all stores (call this monthly via cron)
 */
export async function resetMonthlyUsage() {
  return await prisma.storeInformation.updateMany({
    data: { monthlyQuestions: 0 }
  });
}

/**
 * Get stores that need referral payouts
 */
export async function getStoresForReferralPayout() {
  return await prisma.storeInformation.findMany({
    where: {
      referralCode: { not: null },
      referrerPayoutId: null,
      pricingPlan: { not: "free" }, // Only paid plans qualify for referral payouts
    },
    select: {
      shop: true,
      referralCode: true,
      pricingPlan: true,
      planStartDate: true,
    }
  });
}

/**
 * Mark referral as paid out
 */
export async function markReferralPaid(shop: string, payoutId: string) {
  return await prisma.storeInformation.update({
    where: { shop },
    data: { referrerPayoutId: payoutId }
  });
}

/**
 * Check if a store has access to a specific feature
 */
export async function hasFeatureAccess(shop: string, feature: string): Promise<boolean> {
  const storeInfo = await prisma.storeInformation.findUnique({
    where: { shop }
  });

  const plan = storeInfo?.pricingPlan || "Free Plan";
  const planLimits = SHOPIFY_PLAN_CONFIGS[plan] || DEFAULT_PLAN_CONFIG;
  
  return planLimits.features.includes(feature);
}