import { prisma } from "../db.server";
import { PLAN_FEATURES } from "./billing.server";

/**
 * Shops that are exempt from all usage limits and have unlimited access.
 * Synced with whitelist in billing-check.server.ts
 */
const WHITELISTED_SHOPS = [
  'ba09dc.myshopify.com',      // Minky Snacks - Shopify domain
  'minkysnacks.com',            // Minky Snacks - Custom domain
];

/**
 * Check if a shop is whitelisted for unlimited free access
 */
function isShopWhitelisted(shop: string): boolean {
  return WHITELISTED_SHOPS.some(whitelistedShop =>
    shop.toLowerCase().includes(whitelistedShop.toLowerCase())
  );
}

export interface PlanLimits {
  monthlyQuestions: number;
  monthlyReviewSummaries: number;
  features: string[];
  priority: "low" | "medium" | "high";
}

// Shopify plan names mapping - synced with billing.server.ts
export const SHOPIFY_PLAN_CONFIGS: Record<string, PlanLimits> = {
  "Pro Plan": {
    monthlyQuestions: -1, // Unlimited
    monthlyReviewSummaries: -1, // Unlimited
    features: PLAN_FEATURES["Pro Plan"].features,
    priority: PLAN_FEATURES["Pro Plan"].priority,
  },
  "Free Plan": {
    monthlyQuestions: 50,
    monthlyReviewSummaries: 10,
    features: ["basic_chat", "question_tracking", "analytics", "review_summaries"],
    priority: "low"
  }
};

// Default plan config for unknown plans (no active subscription)
const DEFAULT_PLAN_CONFIG: PlanLimits = {
  monthlyQuestions: 50,
  monthlyReviewSummaries: 10,
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
 * Update store plan (called from billing webhooks and callbacks)
 */
export async function updateStorePlan({
  shop,
  plan,
  referralCode,
  subscriptionStatus,
}: {
  shop: string;
  plan: string;
  referralCode?: string;
  subscriptionStatus?: string;
}) {
  const planLimits = SHOPIFY_PLAN_CONFIGS[plan] || DEFAULT_PLAN_CONFIG;

  console.log(`[Plan Management] Updating store ${shop} to plan: ${plan}, status: ${subscriptionStatus || 'not provided'}`, planLimits);

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
        subscriptionStatus: subscriptionStatus || existingStore.subscriptionStatus,
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
        subscriptionStatus: subscriptionStatus || "ACTIVE",
      }
    });
  }
}

/**
 * Helper to check if a new month has started
 */
function isNewMonth(monthStart: Date | null): boolean {
  if (!monthStart) return true;

  const now = new Date();
  const start = new Date(monthStart);

  // Check if we're in a different month or year
  return now.getMonth() !== start.getMonth() || now.getFullYear() !== start.getFullYear();
}

/**
 * Check question limits WITHOUT incrementing (call BEFORE logging question)
 */
export async function checkQuestionLimit(shop: string) {
  // Check whitelist first - these shops get unlimited access
  if (isShopWhitelisted(shop)) {
    console.log(`🤍 [Plan] Whitelisted shop (${shop}) - unlimited questions`);
    return { allowed: true, remaining: -1, limit: -1 };
  }

  const storeInfo = await prisma.storeInformation.findUnique({
    where: { shop }
  });

  if (!storeInfo) {
    // First-time user, allow and they'll be on free plan
    return {
      allowed: true,
      remaining: DEFAULT_PLAN_CONFIG.monthlyQuestions,
      limit: DEFAULT_PLAN_CONFIG.monthlyQuestions
    };
  }

  // Check if new month - reset if needed
  if (isNewMonth(storeInfo.questionMonthStart)) {
    await prisma.storeInformation.update({
      where: { shop },
      data: {
        monthlyQuestions: 0,
        questionMonthStart: new Date()
      }
    });

    const planLimits = SHOPIFY_PLAN_CONFIGS[storeInfo.pricingPlan || "Free Plan"] || DEFAULT_PLAN_CONFIG;
    return {
      allowed: true,
      remaining: planLimits.monthlyQuestions === -1 ? -1 : planLimits.monthlyQuestions,
      limit: planLimits.monthlyQuestions
    };
  }

  const planLimits = SHOPIFY_PLAN_CONFIGS[storeInfo.pricingPlan || "Free Plan"] || DEFAULT_PLAN_CONFIG;
  const currentUsage = storeInfo.monthlyQuestions || 0;

  // Check if unlimited plan
  if (planLimits.monthlyQuestions === -1) {
    return { allowed: true, remaining: -1, limit: -1 };
  }

  // Check if within limits
  if (currentUsage >= planLimits.monthlyQuestions) {
    return {
      allowed: false,
      remaining: 0,
      limit: planLimits.monthlyQuestions,
      message: `Monthly limit of ${planLimits.monthlyQuestions} questions reached. Upgrade to Pro Plan for unlimited questions.`
    };
  }

  return {
    allowed: true,
    remaining: planLimits.monthlyQuestions - currentUsage,
    limit: planLimits.monthlyQuestions
  };
}

/**
 * Increment question count for a store (call AFTER question is answered)
 */
export async function incrementQuestionCount(shop: string) {
  const storeInfo = await prisma.storeInformation.findUnique({
    where: { shop }
  });

  if (!storeInfo) {
    // Create default store record if none exists
    await prisma.storeInformation.create({
      data: {
        shop,
        pricingPlan: "Free Plan",
        planLimits: DEFAULT_PLAN_CONFIG,
        monthlyQuestions: 1,
        questionMonthStart: new Date(),
      }
    });
    return { allowed: true, remaining: DEFAULT_PLAN_CONFIG.monthlyQuestions - 1 };
  }

  // Check if new month - reset if needed
  if (isNewMonth(storeInfo.questionMonthStart)) {
    await prisma.storeInformation.update({
      where: { shop },
      data: {
        monthlyQuestions: 1, // Start at 1 for this question
        questionMonthStart: new Date()
      }
    });

    const planLimits = SHOPIFY_PLAN_CONFIGS[storeInfo.pricingPlan || "Free Plan"] || DEFAULT_PLAN_CONFIG;
    return {
      allowed: true,
      remaining: planLimits.monthlyQuestions === -1 ? -1 : planLimits.monthlyQuestions - 1
    };
  }

  const planLimits = SHOPIFY_PLAN_CONFIGS[storeInfo.pricingPlan || "Free Plan"] || DEFAULT_PLAN_CONFIG;
  const currentUsage = storeInfo.monthlyQuestions || 0;

  // Increment usage
  await prisma.storeInformation.update({
    where: { shop },
    data: { monthlyQuestions: currentUsage + 1 }
  });

  return {
    allowed: true,
    remaining: planLimits.monthlyQuestions === -1 ? -1 : planLimits.monthlyQuestions - (currentUsage + 1)
  };
}

/**
 * Check review summary limits WITHOUT incrementing (call BEFORE generating summary)
 */
export async function checkReviewSummaryLimit(shop: string) {
  // Check whitelist first - these shops get unlimited access
  if (isShopWhitelisted(shop)) {
    console.log(`🤍 [Plan] Whitelisted shop (${shop}) - unlimited review summaries`);
    return { allowed: true, remaining: -1, limit: -1 };
  }

  const storeInfo = await prisma.storeInformation.findUnique({
    where: { shop }
  });

  if (!storeInfo) {
    // First-time user, allow and they'll be on free plan
    return {
      allowed: true,
      remaining: DEFAULT_PLAN_CONFIG.monthlyReviewSummaries,
      limit: DEFAULT_PLAN_CONFIG.monthlyReviewSummaries
    };
  }

  // Check if new month - reset if needed
  if (isNewMonth(storeInfo.reviewMonthStart)) {
    await prisma.storeInformation.update({
      where: { shop },
      data: {
        reviewSummariesGenerated: 0,
        reviewMonthStart: new Date()
      }
    });

    const planLimits = SHOPIFY_PLAN_CONFIGS[storeInfo.pricingPlan || "Free Plan"] || DEFAULT_PLAN_CONFIG;
    return {
      allowed: true,
      remaining: planLimits.monthlyReviewSummaries === -1 ? -1 : planLimits.monthlyReviewSummaries,
      limit: planLimits.monthlyReviewSummaries
    };
  }

  const planLimits = SHOPIFY_PLAN_CONFIGS[storeInfo.pricingPlan || "Free Plan"] || DEFAULT_PLAN_CONFIG;
  const currentUsage = storeInfo.reviewSummariesGenerated || 0;

  // Check if unlimited plan
  if (planLimits.monthlyReviewSummaries === -1) {
    return { allowed: true, remaining: -1, limit: -1 };
  }

  // Check if within limits
  if (currentUsage >= planLimits.monthlyReviewSummaries) {
    return {
      allowed: false,
      remaining: 0,
      limit: planLimits.monthlyReviewSummaries,
      message: `Monthly limit of ${planLimits.monthlyReviewSummaries} review summaries reached. Upgrade to Pro Plan for unlimited summaries.`
    };
  }

  return {
    allowed: true,
    remaining: planLimits.monthlyReviewSummaries - currentUsage,
    limit: planLimits.monthlyReviewSummaries
  };
}

/**
 * Increment review summary count for a store (call AFTER summary is generated)
 */
export async function incrementReviewSummaryCount(shop: string) {
  const storeInfo = await prisma.storeInformation.findUnique({
    where: { shop }
  });

  if (!storeInfo) {
    // Create default store record if none exists
    await prisma.storeInformation.create({
      data: {
        shop,
        pricingPlan: "Free Plan",
        planLimits: DEFAULT_PLAN_CONFIG,
        reviewSummariesGenerated: 1,
        reviewMonthStart: new Date(),
      }
    });
    return { allowed: true, remaining: DEFAULT_PLAN_CONFIG.monthlyReviewSummaries - 1 };
  }

  // Check if new month - reset if needed
  if (isNewMonth(storeInfo.reviewMonthStart)) {
    await prisma.storeInformation.update({
      where: { shop },
      data: {
        reviewSummariesGenerated: 1, // Start at 1 for this summary
        reviewMonthStart: new Date()
      }
    });

    const planLimits = SHOPIFY_PLAN_CONFIGS[storeInfo.pricingPlan || "Free Plan"] || DEFAULT_PLAN_CONFIG;
    return {
      allowed: true,
      remaining: planLimits.monthlyReviewSummaries === -1 ? -1 : planLimits.monthlyReviewSummaries - 1
    };
  }

  const planLimits = SHOPIFY_PLAN_CONFIGS[storeInfo.pricingPlan || "Free Plan"] || DEFAULT_PLAN_CONFIG;
  const currentUsage = storeInfo.reviewSummariesGenerated || 0;

  // Increment usage
  await prisma.storeInformation.update({
    where: { shop },
    data: { reviewSummariesGenerated: currentUsage + 1 }
  });

  return {
    allowed: true,
    remaining: planLimits.monthlyReviewSummaries === -1 ? -1 : planLimits.monthlyReviewSummaries - (currentUsage + 1)
  };
}

/**
 * Reset monthly usage for all stores (call this monthly via cron)
 * @deprecated - Monthly resets now happen automatically via isNewMonth() checks
 */
export async function resetMonthlyUsage() {
  return await prisma.storeInformation.updateMany({
    data: {
      monthlyQuestions: 0,
      reviewSummariesGenerated: 0,
      questionMonthStart: new Date(),
      reviewMonthStart: new Date()
    }
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
      pricingPlan: "Pro Plan", // Only Pro Plan qualifies for referral payouts
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