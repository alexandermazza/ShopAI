/**
 * Check Billing Status for All Stores
 *
 * This script queries the database to show the billing/subscription status
 * of all stores that have installed your app.
 *
 * Usage:
 *   npx tsx scripts/check-billing-status.ts
 *   npx tsx scripts/check-billing-status.ts --shop example.myshopify.com
 */

import { prisma } from "../app/db.server";
import { BILLING_PLANS, PLAN_FEATURES } from "../app/utils/billing.server";

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const GRAY = '\x1b[90m';
const RESET = '\x1b[0m';

interface StoreSubscription {
  shop: string;
  pricingPlan: string | null;
  planStartDate: Date | null;
  createdAt: Date;
  subscriptionStatus: string | null;
}

function formatDate(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

  return date.toLocaleDateString();
}

function getPlanStatus(plan: string | null, status: string | null): string {
  if (!plan) return `${RED}No Plan${RESET}`;
  const statusSuffix = status ? ` (${status})` : '';
  if (plan === BILLING_PLANS.PRO) return `${GREEN}${plan}${statusSuffix}${RESET}`;
  return `${YELLOW}${plan}${statusSuffix}${RESET}`;
}

function printStoreSummary(store: StoreSubscription) {
  console.log(`\n${BLUE}╔════════════════════════════════════════════╗${RESET}`);
  console.log(`${BLUE}║  ${store.shop.padEnd(40)} ║${RESET}`);
  console.log(`${BLUE}╚════════════════════════════════════════════╝${RESET}\n`);

  console.log(`  Current Plan:    ${getPlanStatus(store.pricingPlan, store.subscriptionStatus)}`);
  console.log(`  Plan Started:    ${GRAY}${formatDate(store.planStartDate)}${RESET}`);
  console.log(`  Installed:       ${GRAY}${formatDate(store.createdAt)}${RESET}`);

  if (store.pricingPlan) {
    const features = PLAN_FEATURES[store.pricingPlan as keyof typeof PLAN_FEATURES];
    if (features) {
      console.log(`  Price:           ${GREEN}$${features.price}/month${RESET}`);
      console.log(`  Trial Days:      ${features.trialDays} days`);
      console.log(`  Questions:       ${features.monthlyQuestions === -1 ? 'Unlimited' : features.monthlyQuestions}`);
    }
  }
}

function printSummaryTable(stores: StoreSubscription[]) {
  console.log(`\n${BLUE}╔════════════════════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BLUE}║                           Subscription Summary                             ║${RESET}`);
  console.log(`${BLUE}╚════════════════════════════════════════════════════════════════════════════╝${RESET}\n`);

  const totalStores = stores.length;
  const paidStores = stores.filter(s => s.pricingPlan === BILLING_PLANS.PRO).length;
  const noPlanStores = stores.filter(s => !s.pricingPlan).length;

  console.log(`  Total Stores:        ${BLUE}${totalStores}${RESET}`);
  console.log(`  Pro Plan:            ${GREEN}${paidStores}${RESET}`);
  console.log(`  No Subscription:     ${noPlanStores > 0 ? RED : GRAY}${noPlanStores}${RESET}`);

  if (paidStores > 0) {
    const monthlyRevenue = paidStores * 15;
    console.log(`  \n  ${GREEN}Monthly Revenue:     $${monthlyRevenue}${RESET}`);
  }
}

function printStoreTable(stores: StoreSubscription[]) {
  console.log(`\n${BLUE}${'Shop'.padEnd(35)}  ${'Plan'.padEnd(20)}  ${'Started'.padEnd(15)}${RESET}`);
  console.log(`${GRAY}${'─'.repeat(75)}${RESET}`);

  for (const store of stores) {
    const shopDisplay = store.shop.length > 32
      ? store.shop.substring(0, 29) + '...'
      : store.shop.padEnd(35);

    const planText = store.pricingPlan || 'No Plan';
    const statusText = store.subscriptionStatus ? ` (${store.subscriptionStatus})` : '';
    const planDisplay = (planText + statusText).padEnd(20);
    const planColor = store.pricingPlan === BILLING_PLANS.PRO ? GREEN :
                     store.pricingPlan ? YELLOW : RED;

    const startedDisplay = formatDate(store.planStartDate).padEnd(15);

    console.log(`${shopDisplay}  ${planColor}${planDisplay}${RESET}  ${GRAY}${startedDisplay}${RESET}`);
  }
}

async function checkSpecificStore(shopDomain: string) {
  try {
    const store = await prisma.storeInformation.findUnique({
      where: { shop: shopDomain },
      select: {
        shop: true,
        pricingPlan: true,
        planStartDate: true,
        createdAt: true,
        subscriptionStatus: true,
      },
    });

    if (!store) {
      console.log(`${RED}✗${RESET} Store not found: ${shopDomain}`);
      console.log(`\n${GRAY}Make sure the shop domain is correct (e.g., example.myshopify.com)${RESET}`);
      return;
    }

    printStoreSummary(store as StoreSubscription);

  } catch (error) {
    console.error(`${RED}Error fetching store data:${RESET}`, error);
  }
}

async function checkAllStores() {
  try {
    const stores = await prisma.storeInformation.findMany({
      select: {
        shop: true,
        pricingPlan: true,
        planStartDate: true,
        createdAt: true,
        subscriptionStatus: true,
      },
      orderBy: {
        planStartDate: 'desc',
      },
    });

    if (stores.length === 0) {
      console.log(`\n${YELLOW}⚠${RESET} No stores found in database`);
      console.log(`${GRAY}This is normal for new installations${RESET}\n`);
      return;
    }

    printSummaryTable(stores as StoreSubscription[]);
    console.log('');
    printStoreTable(stores as StoreSubscription[]);
    console.log('');

  } catch (error) {
    console.error(`${RED}Error fetching stores:${RESET}`, error);
  }
}

async function main() {
  console.log(`\n${BLUE}╔════════════════════════════════════════════╗${RESET}`);
  console.log(`${BLUE}║      ShopAI Billing Status Checker        ║${RESET}`);
  console.log(`${BLUE}╚════════════════════════════════════════════╝${RESET}\n`);

  // Check for --shop argument
  const args = process.argv.slice(2);
  const shopIndex = args.indexOf('--shop');

  if (shopIndex !== -1 && args[shopIndex + 1]) {
    const shopDomain = args[shopIndex + 1];
    console.log(`${BLUE}Checking specific store:${RESET} ${shopDomain}\n`);
    await checkSpecificStore(shopDomain);
  } else {
    console.log(`${BLUE}Checking all stores...${RESET}\n`);
    await checkAllStores();
    console.log(`${GRAY}Tip: Use --shop <domain> to check a specific store${RESET}\n`);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(`${RED}Fatal error:${RESET}`, error);
  process.exit(1);
});
