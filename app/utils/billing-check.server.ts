import { redirect } from "@remix-run/node";
import { BILLING_PLANS, getPaidPlans } from "./billing.server";
import { prisma } from "../db.server";
import { shopifyApi, LATEST_API_VERSION, Session } from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/node";

/**
 * Shops that are exempt from all billing checks and have unlimited access.
 * Add both .myshopify.com domains AND custom domains for complete coverage.
 * These shops will ALWAYS return true from hasActiveSubscriptionViaAPI.
 */
const WHITELISTED_SHOPS = [
  'ba09dc.myshopify.com',      // Minky Snacks - Shopify domain
  'minkysnacks.com',            // Minky Snacks - Custom domain
  // Add more whitelisted shops here as needed
];

/**
 * Check if a shop is whitelisted for unlimited free access
 */
function isShopWhitelisted(shop: string): boolean {
  return WHITELISTED_SHOPS.some(whitelistedShop =>
    shop.toLowerCase().includes(whitelistedShop.toLowerCase())
  );
}

/**
 * Middleware to check if a shop has an active paid subscription
 * Use this in loaders/actions that require a paid plan
 */
export async function requireBilling(
  admin: any,
  returnUrl?: string
): Promise<void> {
  const { billing: billingCheck } = await admin;

  try {
    // Check if shop has any active paid plan
    await billingCheck.require({
      plans: getPaidPlans(),
      isTest: process.env.NODE_ENV !== "production",
      onFailure: async () => {
        // Redirect to plan selection page if no active subscription
        throw redirect(returnUrl || "/app/pricing");
      },
    });
  } catch (error) {
    // If it's a redirect, rethrow it
    if (error instanceof Response) {
      throw error;
    }

    // Log other errors and redirect to pricing
    console.error("[Billing Check] Error checking billing status:", error);
    throw redirect(returnUrl || "/app/pricing");
  }
}

/**
 * Check if shop has a specific plan
 */
export async function requireSpecificPlan(
  admin: any,
  plan: string,
  returnUrl?: string
): Promise<void> {
  const { billing: billingCheck } = await admin;

  try {
    await billingCheck.require({
      plans: [plan],
      isTest: process.env.NODE_ENV !== "production",
      onFailure: async () => {
        throw redirect(returnUrl || "/app/pricing");
      },
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error(`[Billing Check] Error checking plan ${plan}:`, error);
    throw redirect(returnUrl || "/app/pricing");
  }
}

/**
 * Get current billing status without throwing
 * Returns subscription info if available
 */
export async function getBillingStatus(admin: any) {
  try {
    const { billing: billingCheck } = await admin;

    const result = await billingCheck.check({
      plans: getPaidPlans(),
      isTest: process.env.NODE_ENV !== "production",
    });

    return {
      hasActivePayment: result.hasActivePayment,
      appSubscriptions: result.appSubscriptions,
    };
  } catch (error) {
    console.error("[Billing Status] Error fetching billing status:", error);
    return {
      hasActivePayment: false,
      appSubscriptions: [],
    };
  }
}

/**
 * Request a new subscription
 */
export async function requestSubscription(
  admin: any,
  plan: string,
  returnUrl: string
) {
  const { billing: billingRequest } = await admin;

  // Validate plan exists
  if (!Object.values(BILLING_PLANS).includes(plan as any)) {
    throw new Error(`Invalid plan: ${plan}`);
  }

  try {
    const response = await billingRequest.request({
      plan,
      isTest: process.env.NODE_ENV !== "production",
      returnUrl,
    });

    return response;
  } catch (error) {
    console.error(`[Billing Request] Error requesting plan ${plan}:`, error);
    throw error;
  }
}

/**
 * Check if a shop has an active subscription by querying Shopify's Billing API
 * This works for app proxy routes that don't have admin context
 * Handles app credits, trial credits, and all Shopify billing scenarios
 *
 * @param shop - The shop domain (e.g., "example.myshopify.com")
 * @returns Promise<boolean> - True if shop has active payment (including credits)
 */
export async function hasActiveSubscriptionViaAPI(shop: string): Promise<boolean> {
  try {
    // Check whitelist first - these shops get unlimited free access
    if (isShopWhitelisted(shop)) {
      console.log(`🤍 [Billing] Whitelisted shop detected (${shop}) - bypassing all subscription checks`);
      return true;
    }

    // Allow dev/test stores to bypass subscription check
    if (shop.includes('myshopify.com') && (shop.includes('test') || shop.includes('dev'))) {
      console.log("🧪 [Billing] Dev/test store detected - bypassing subscription check");
      return true;
    }

    // Get the shop's offline session from database
    const sessionRecord = await prisma.session.findFirst({
      where: {
        shop,
        isOnline: false, // Get offline session for app-level operations
      },
      orderBy: { expires: 'desc' },
    });

    if (!sessionRecord) {
      console.warn(`⚠️ [Billing] No offline session found for shop: ${shop}`);
      return await fallbackToDatabaseCheck(shop);
    }

    // Check if session is expired
    if (sessionRecord.expires && new Date(sessionRecord.expires) < new Date()) {
      console.warn(`⚠️ [Billing] Session expired for shop: ${shop}`);
      return await fallbackToDatabaseCheck(shop);
    }

    if (!sessionRecord.accessToken) {
      console.warn(`⚠️ [Billing] No access token in session for shop: ${shop}`);
      return await fallbackToDatabaseCheck(shop);
    }

    try {
      // Initialize Shopify API client
      const shopifyApiClient = shopifyApi({
        apiKey: process.env.SHOPIFY_API_KEY!,
        apiSecretKey: process.env.SHOPIFY_API_SECRET!,
        scopes: process.env.SCOPES?.split(',') || [],
        hostName: new URL(process.env.SHOPIFY_APP_URL!).hostname,
        apiVersion: LATEST_API_VERSION,
        isEmbeddedApp: true,
      });

      // Create a Session object from the database record
      const session = new Session({
        id: sessionRecord.id,
        shop: sessionRecord.shop,
        state: sessionRecord.state,
        isOnline: false,
        accessToken: sessionRecord.accessToken,
        scope: sessionRecord.scope || undefined,
      });

      // Create GraphQL client with the session
      const client = new shopifyApiClient.clients.Graphql({ session });

      // Query subscription status from Shopify
      const response = await client.request(`
        query {
          currentAppInstallation {
            activeSubscriptions {
              id
              name
              status
              test
            }
          }
        }
      `);

      const subscriptions = (response as any)?.data?.currentAppInstallation?.activeSubscriptions || [];

      // Log all subscriptions for debugging
      if (subscriptions.length > 0) {
        console.log(`📊 [Billing] Found ${subscriptions.length} subscription(s) for ${shop}:`,
          subscriptions.map((s: any) => `${s.name} (${s.status})`).join(', '));
      }

      // Check if any subscription is ACTIVE
      // This includes: regular subscriptions, app credits, trial credits, AND custom discounted plans
      const hasActive = subscriptions.some((sub: any) => sub.status === 'ACTIVE');

      if (hasActive) {
        console.log(`✅ [Billing] Active subscription found via Shopify API for ${shop}`);
        return true;
      }

      console.log(`📊 [Billing] No active subscription via API for ${shop}, checking database...`);
      return await fallbackToDatabaseCheck(shop);

    } catch (apiError) {
      console.error(`❌ [Billing] Error querying Shopify API for ${shop}:`, apiError);
      return await fallbackToDatabaseCheck(shop);
    }

  } catch (error) {
    console.error(`❌ [Billing] Error checking subscription for ${shop}:`, error);
    return false;
  }
}

/**
 * Fallback method: Check database for subscription info
 * Used when Shopify API is unavailable or session is expired
 */
async function fallbackToDatabaseCheck(shop: string): Promise<boolean> {
  try {
    const storeInfo = await prisma.storeInformation.findUnique({
      where: { shop },
      select: { pricingPlan: true, subscriptionStatus: true }
    });

    if (!storeInfo) {
      console.log(`📊 [Billing] No store info in database for ${shop}`);
      return false;
    }

    const hasProPlan = storeInfo.pricingPlan === BILLING_PLANS.PRO;
    const isActive = !storeInfo.subscriptionStatus ||
                     storeInfo.subscriptionStatus === 'ACTIVE';

    const result = hasProPlan && isActive;
    console.log(`📊 [Billing] Database check for ${shop}: ${result ? 'ACTIVE' : 'INACTIVE'}`);
    return result;

  } catch (error) {
    console.error(`❌ [Billing] Database fallback error for ${shop}:`, error);
    return false;
  }
}
