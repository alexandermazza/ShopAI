import { BillingInterval } from "@shopify/shopify-app-remix/server";

// Billing plan identifiers
export const BILLING_PLANS = {
  PRO: "Pro Plan",
} as const;

// Billing configuration for shopifyApp
export const billingConfig = {
  [BILLING_PLANS.PRO]: {
    lineItems: [
      {
        amount: 15,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
      },
    ],
  },
} as const;

// Plan features and limits (synced with plan-management.server.ts)
export const PLAN_FEATURES = {
  [BILLING_PLANS.PRO]: {
    monthlyQuestions: -1, // unlimited
    features: [
      "basic_chat",
      "question_tracking",
      "analytics",
      "advanced_ai",
      "priority_support",
      "review_summaries",
    ],
    priority: "high" as const,
    price: 15,
    trialDays: 0, // No free trial
  },
} as const;

// Helper to get all paid plan names
export function getPaidPlans(): string[] {
  return [BILLING_PLANS.PRO];
}

// Helper to check if a plan is paid
export function isPaidPlan(plan: string): boolean {
  return getPaidPlans().includes(plan);
}

// Helper to get plan details
export function getPlanDetails(plan: string) {
  return PLAN_FEATURES[plan as keyof typeof PLAN_FEATURES] || PLAN_FEATURES[BILLING_PLANS.FREE];
}
