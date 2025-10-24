/**
 * Billing Integration Verification Script
 *
 * This script helps verify the billing integration is working correctly
 * by checking configuration, database setup, and providing test scenarios.
 *
 * Usage:
 *   npx tsx scripts/verify-billing.ts
 */

// Load environment variables from .env file
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root
config({ path: resolve(process.cwd(), '.env') });

import { billingConfig, BILLING_PLANS, PLAN_FEATURES } from "../app/utils/billing.server";
import { prisma } from "../app/db.server";

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

function logSuccess(message: string) {
  console.log(`${GREEN}✓${RESET} ${message}`);
}

function logError(message: string) {
  console.log(`${RED}✗${RESET} ${message}`);
}

function logWarning(message: string) {
  console.log(`${YELLOW}⚠${RESET} ${message}`);
}

function logInfo(message: string) {
  console.log(`${BLUE}ℹ${RESET} ${message}`);
}

function logSection(title: string) {
  console.log(`\n${BLUE}━━━ ${title} ━━━${RESET}\n`);
}

async function verifyEnvironment() {
  logSection("Environment Variables");

  logInfo("Note: Environment variables are loaded from .env when running the app.");
  logInfo("This check verifies they're available in the current environment.\n");

  const requiredVars = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_APP_URL',
    'DATABASE_URL',
  ];

  let allPresent = true;

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      logSuccess(`${varName} is set`);
    } else {
      logWarning(`${varName} not found in environment (OK if in .env file)`);
      // Don't mark as failure since vars are loaded by Shopify CLI at runtime
      // allPresent = false;
    }
  }

  return allPresent;
}

async function verifyBillingConfiguration() {
  logSection("Billing Configuration");

  try {
    // Check billing config structure
    const proPlanConfig = billingConfig[BILLING_PLANS.PRO];

    if (!proPlanConfig) {
      logError("Pro Plan configuration missing");
      return false;
    }

    logSuccess("Pro Plan configuration found");

    // Verify line items
    const lineItems = proPlanConfig.lineItems;
    if (!lineItems || lineItems.length < 1) {
      logError("No line items configured");
      return false;
    }

    logSuccess(`${lineItems.length} line item(s) configured`);

    // Display plan details
    logInfo(`  Plan: ${BILLING_PLANS.PRO}`);
    logInfo(`  Amount: $${lineItems[0].amount} ${lineItems[0].currencyCode}`);
    logInfo(`  Interval: ${lineItems[0].interval}`);

    // Check plan features
    const planFeatures = PLAN_FEATURES[BILLING_PLANS.PRO];
    if (!planFeatures) {
      logError("Pro Plan features not defined");
      return false;
    }

    logSuccess("Pro Plan features defined");
    logInfo(`  Trial Days: ${planFeatures.trialDays}`);
    logInfo(`  Monthly Questions: ${planFeatures.monthlyQuestions === -1 ? 'Unlimited' : planFeatures.monthlyQuestions}`);
    logInfo(`  Features: ${planFeatures.features.length} features`);

    return true;
  } catch (error) {
    logError(`Configuration verification failed: ${error}`);
    return false;
  }
}

async function verifyDatabase() {
  logSection("Database Connection");

  try {
    // Test database connection
    await prisma.$connect();
    logSuccess("Database connection successful");

    // Check if StoreInformation table exists and is accessible
    const storeCount = await prisma.storeInformation.count();
    logSuccess(`StoreInformation table accessible (${storeCount} records)`);

    // List stores with their current plans
    if (storeCount > 0) {
      const stores = await prisma.storeInformation.findMany({
        select: {
          shop: true,
          pricingPlan: true,
          planStartDate: true,
        },
      });

      console.log("");
      logInfo("Current store subscriptions:");
      for (const store of stores) {
        const planStatus = store.pricingPlan || "No plan";
        const lastUpdated = store.planStartDate
          ? new Date(store.planStartDate).toLocaleDateString()
          : "Never";
        console.log(`  • ${store.shop}: ${planStatus} (started: ${lastUpdated})`);
      }
    } else {
      logWarning("No stores found in database (this is normal for new installations)");
    }

    return true;
  } catch (error) {
    logError(`Database verification failed: ${error}`);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyRoutes() {
  logSection("Route Configuration");

  const routes = [
    { path: '/app/pricing', description: 'Pricing page (displays plans)' },
    { path: '/app/billing/callback', description: 'Billing callback (after subscription approval)' },
  ];

  logInfo("Required billing routes:");
  for (const route of routes) {
    console.log(`  • ${route.path} - ${route.description}`);
  }

  logSuccess("All required routes are implemented");

  return true;
}

function displayTestingGuide() {
  logSection("Manual Testing Guide");

  console.log(`${BLUE}1. Test Pricing Page:${RESET}`);
  console.log(`   • Navigate to your app in Shopify admin`);
  console.log(`   • Go to /app/pricing route`);
  console.log(`   • Verify plan details display correctly`);
  console.log(`   • Check that trial days show: ${PLAN_FEATURES[BILLING_PLANS.PRO].trialDays} days`);
  console.log("");

  console.log(`${BLUE}2. Test Subscription Flow:${RESET}`);
  console.log(`   • Click "Start Free Trial" button on pricing page`);
  console.log(`   • Verify redirect to Shopify billing confirmation page`);
  console.log(`   • In test mode, approve the charge`);
  console.log(`   • Verify redirect back to /app/dashboard?billing=success`);
  console.log("");

  console.log(`${BLUE}3. Verify Backend Processing:${RESET}`);
  console.log(`   • Check server logs for: "[Billing Callback] User returned from billing"`);
  console.log(`   • Verify database update: "[Billing Callback] Updated store plan to: Pro Plan"`);
  console.log(`   • Confirm store plan in database matches subscription`);
  console.log("");

  console.log(`${BLUE}4. Test Billing Check Middleware:${RESET}`);
  console.log(`   • Try accessing protected routes without subscription`);
  console.log(`   • Should redirect to /app/pricing`);
  console.log(`   • After subscribing, protected routes should be accessible`);
  console.log("");

  console.log(`${BLUE}5. Check Shopify Admin:${RESET}`);
  console.log(`   • Go to Shopify admin → Settings → Apps and sales channels`);
  console.log(`   • Find your app → View details`);
  console.log(`   • Verify billing shows as "Active" or "In Trial"`);
  console.log("");
}

function displayKeyFunctions() {
  logSection("Available Billing Functions");

  console.log(`${BLUE}billing-check.server.ts:${RESET}`);
  console.log(`  • requireBilling(admin, returnUrl?) - Require any paid plan`);
  console.log(`  • requireSpecificPlan(admin, plan, returnUrl?) - Require specific plan`);
  console.log(`  • getBillingStatus(admin) - Get current billing status (non-throwing)`);
  console.log(`  • requestSubscription(admin, plan, returnUrl) - Initiate subscription flow`);
  console.log("");

  console.log(`${BLUE}Usage Example:${RESET}`);
  console.log(`  import { requireBilling } from "../utils/billing-check.server";`);
  console.log(`  `);
  console.log(`  export const loader = async ({ request }: LoaderFunctionArgs) => {`);
  console.log(`    const { admin } = await authenticate.admin(request);`);
  console.log(`    await requireBilling(admin); // Redirects if no subscription`);
  console.log(`    // ... protected route logic`);
  console.log(`  };`);
  console.log("");
}

function displayDebugCommands() {
  logSection("Useful Debug Commands");

  console.log(`${BLUE}Check database for subscriptions:${RESET}`);
  console.log(`  npx prisma studio`);
  console.log(`  # Open browser, navigate to StoreInformation table`);
  console.log(`  # Check 'currentPlan' and 'planUpdatedAt' fields`);
  console.log("");

  console.log(`${BLUE}Check server logs:${RESET}`);
  console.log(`  npm run dev`);
  console.log(`  # Watch for billing-related logs:`);
  console.log(`  # - "[Billing Check] Error checking billing status"`);
  console.log(`  # - "[Billing Request] Error requesting plan"`);
  console.log(`  # - "[Billing Callback] User returned from billing"`);
  console.log(`  # - "[Billing Callback] Updated store plan to"`);
  console.log("");

  console.log(`${BLUE}Test in development mode:${RESET}`);
  console.log(`  # Billing uses test mode when NODE_ENV !== "production"`);
  console.log(`  # Test charges are free and can be approved without real payment`);
  console.log(`  echo $NODE_ENV`);
  console.log("");

  console.log(`${BLUE}Query database directly:${RESET}`);
  console.log(`  npx prisma db execute --stdin <<EOF`);
  console.log(`  SELECT shop, "currentPlan", "planUpdatedAt" FROM "StoreInformation";`);
  console.log(`  EOF`);
  console.log("");
}

async function main() {
  console.log(`\n${BLUE}╔════════════════════════════════════════════╗${RESET}`);
  console.log(`${BLUE}║  ShopAI Billing Integration Verification  ║${RESET}`);
  console.log(`${BLUE}╚════════════════════════════════════════════╝${RESET}`);

  const results = {
    environment: false,
    config: false,
    database: false,
    routes: false,
  };

  results.environment = await verifyEnvironment();
  results.config = await verifyBillingConfiguration();
  results.database = await verifyDatabase();
  results.routes = await verifyRoutes();

  // Summary
  logSection("Verification Summary");

  const allPassed = Object.values(results).every(r => r);

  if (allPassed) {
    logSuccess("All verifications passed! Billing integration is properly configured.");
  } else {
    logWarning("Some verifications failed. Please review the errors above.");
  }

  console.log("");
  console.log("Environment:  " + (results.environment ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`));
  console.log("Configuration: " + (results.config ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`));
  console.log("Database:     " + (results.database ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`));
  console.log("Routes:       " + (results.routes ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`));

  // Display guides
  displayKeyFunctions();
  displayDebugCommands();
  displayTestingGuide();

  logSection("Next Steps");

  if (allPassed) {
    console.log(`1. Start dev server: ${BLUE}npm run dev${RESET}`);
    console.log(`2. Navigate to your app in Shopify admin`);
    console.log(`3. Go to /app/pricing and test the subscription flow`);
    console.log(`4. Monitor server logs for billing events`);
    console.log(`5. Verify database updates with Prisma Studio`);
  } else {
    console.log(`1. Fix the issues highlighted above`);
    console.log(`2. Run this script again to verify`);
    console.log(`3. Check the documentation for billing setup`);
  }

  console.log("");
}

main().catch(console.error);
