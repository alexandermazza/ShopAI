# Billing Integration Verification Guide

This document provides comprehensive instructions for verifying that your billing integration is working correctly on the backend.

## Quick Start

Run these commands to verify your billing integration:

```bash
# Verify billing configuration and setup
npm run billing:verify

# Check current subscription status of all stores
npm run billing:status

# Check specific store
npm run billing:status -- --shop your-store.myshopify.com
```

---

## What Gets Verified

### ✅ Configuration Layer

**Files checked:**
- [app/utils/billing.server.ts](app/utils/billing.server.ts) - Billing configuration
- [app/utils/billing-check.server.ts](app/utils/billing-check.server.ts) - Middleware functions
- [app/shopify.server.ts](app/shopify.server.ts:21) - Integration with Shopify SDK

**What's verified:**
- Pro Plan is configured: $15/month, 7-day trial
- Line items are properly structured
- Plan features are defined (unlimited questions, 6 features)
- Billing config is passed to `shopifyApp()`

### ✅ Database Layer

**Files checked:**
- [prisma/schema.prisma](prisma/schema.prisma) - Schema definition
- Database connection and tables

**What's verified:**
- `StoreInformation` table exists
- `currentPlan` field exists
- `planUpdatedAt` timestamp field exists
- Database is accessible from backend

### ✅ Route Layer

**Files checked:**
- [app/routes/app.pricing.tsx](app/routes/app.pricing.tsx) - Pricing page and subscription initiation
- [app/routes/app.billing.callback.tsx](app/routes/app.billing.callback.tsx) - Post-subscription callback
- [app/routes/webhooks.subscriptions.update.tsx](app/routes/webhooks.subscriptions.update.tsx) - Webhook handler

**What's verified:**
- All required routes are implemented
- Loader/action functions are defined
- Error handling is in place

### ✅ Webhook Layer

**Files checked:**
- [shopify.app.toml](shopify.app.toml:35-37) - Webhook registration

**What's verified:**
- `app_subscriptions/update` webhook is registered
- URI points to correct route (`/webhooks/subscriptions/update`)
- API version is specified

---

## Backend Components

### 1. Billing Configuration ([billing.server.ts](app/utils/billing.server.ts))

**Purpose:** Defines billing plans and features

**Key exports:**
```typescript
BILLING_PLANS = {
  PRO: "Pro Plan"
}

PLAN_FEATURES = {
  "Pro Plan": {
    monthlyQuestions: -1,    // unlimited
    features: [...],         // 6 features
    price: 15,
    trialDays: 7
  }
}
```

**Integration:**
- Used by `shopifyApp()` initialization in [shopify.server.ts:21](app/shopify.server.ts#L21)
- Powers pricing page display
- Validates subscription requests

### 2. Billing Check Middleware ([billing-check.server.ts](app/utils/billing-check.server.ts))

**Purpose:** Provides functions to check and require billing

**Available functions:**

| Function | Purpose | Returns |
|----------|---------|---------|
| `requireBilling(admin, returnUrl?)` | Require any paid plan (middleware) | Redirects if no subscription |
| `requireSpecificPlan(admin, plan, returnUrl?)` | Require specific plan | Redirects if wrong plan |
| `getBillingStatus(admin)` | Get current status (non-throwing) | `{ hasActivePayment, appSubscriptions }` |
| `requestSubscription(admin, plan, returnUrl)` | Initiate subscription flow | `{ confirmationUrl }` |

**Usage example:**
```typescript
// In any loader that requires subscription
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  await requireBilling(admin); // Redirects to /app/pricing if no subscription
  // ... protected route logic
};
```

### 3. Pricing Page ([app.pricing.tsx](app/routes/app.pricing.tsx))

**Purpose:** Display plans and initiate subscriptions

**Loader:**
- Authenticates merchant
- Gets current billing status via `getBillingStatus(admin)`
- Returns plan details and subscription state

**Action:**
- Receives plan selection from form
- Calls `requestSubscription(admin, plan, returnUrl)`
- Redirects to Shopify confirmation URL

**Flow:**
```
User clicks "Start Free Trial"
  ↓
POST to /app/pricing (action)
  ↓
requestSubscription() called
  ↓
Redirect to Shopify confirmation page
  ↓
User approves charge
  ↓
Redirect to /app/billing/callback
```

### 4. Billing Callback ([app.billing.callback.tsx](app/routes/app.billing.callback.tsx))

**Purpose:** Handle return from Shopify after subscription approval

**Process:**
1. Receives `charge_id` and `plan` query params
2. Authenticates session
3. Updates database via `updateStorePlan({ shop, plan })`
4. Redirects to `/app/dashboard?billing=success`

**Logs to watch for:**
```
[Billing Callback] User returned from billing: { shop, chargeId, plan }
[Billing Callback] Updated store plan to: Pro Plan
```

### 5. Subscription Webhook ([webhooks.subscriptions.update.tsx](app/routes/webhooks.subscriptions.update.tsx))

**Purpose:** Handle subscription lifecycle events from Shopify

**Events handled:**
- `ACTIVE` - Subscription activated (new or trial → paid)
- `CANCELLED` - Merchant cancelled
- `EXPIRED` - Subscription expired

**Process:**
1. Authenticates webhook (HMAC verification)
2. Extracts subscription data from payload
3. Updates database based on status
4. Returns success response

**Logs to watch for:**
```
[Subscription Webhook] Received subscription update: { shop, status, name }
[Subscription Webhook] Activating plan: Pro Plan for shop.myshopify.com
```

---

## Verification Commands

### 1. Comprehensive Verification

```bash
npm run billing:verify
```

**What it checks:**
- ✅ Environment variables (SHOPIFY_API_KEY, SHOPIFY_API_SECRET, etc.)
- ✅ Billing configuration structure
- ✅ Database connection and tables
- ✅ Required routes implementation

**Expected output:**
```
╔════════════════════════════════════════════╗
║  ShopAI Billing Integration Verification  ║
╚════════════════════════════════════════════╝

━━━ Environment Variables ━━━
✓ SHOPIFY_API_KEY is set
✓ SHOPIFY_API_SECRET is set
...

━━━ Verification Summary ━━━
✓ All verifications passed!
```

### 2. Check Subscription Status

```bash
# All stores
npm run billing:status

# Specific store
npm run billing:status -- --shop your-store.myshopify.com
```

**Expected output:**
```
╔════════════════════════════════════════════════════════════════════════════╗
║                           Subscription Summary                             ║
╚════════════════════════════════════════════════════════════════════════════╝

  Total Stores:        2
  Pro Plan:            1
  No Subscription:     1

  Monthly Revenue:     $15

Shop                                Plan              Updated
──────────────────────────────────────────────────────────────────────────
test-store.myshopify.com            Pro Plan          Today
another-store.myshopify.com         No Plan           Never
```

### 3. Database Query

```bash
# Using Prisma Studio (GUI)
npx prisma studio
# Navigate to StoreInformation table

# Direct database query
npx prisma db execute --stdin <<EOF
SELECT shop, "currentPlan", "planUpdatedAt"
FROM "StoreInformation"
ORDER BY "planUpdatedAt" DESC;
EOF
```

---

## Manual Testing Checklist

### Test 1: Pricing Page Display ✅

1. Start dev server: `npm run dev`
2. Navigate to your app in Shopify admin
3. Go to `/app/pricing` route
4. **Verify:**
   - ✅ Plan shows "$15 per month"
   - ✅ "7-day free trial included" badge displays
   - ✅ Features list shows (unlimited questions, etc.)
   - ✅ "Start 7-Day Free Trial" button is visible

### Test 2: Subscription Flow ✅

1. Click "Start Free Trial" button
2. **Verify:** Redirected to Shopify billing confirmation page
3. In test mode, click "Approve"
4. **Verify:** Redirected to `/app/dashboard?billing=success`
5. Check server logs for:
   ```
   [Billing Callback] User returned from billing
   [Billing Callback] Updated store plan to: Pro Plan
   ```
6. Run `npm run billing:status`
7. **Verify:** Store shows "Pro Plan" with today's date

### Test 3: Database Persistence ✅

1. After completing subscription (Test 2)
2. Open Prisma Studio: `npx prisma studio`
3. Navigate to `StoreInformation` table
4. **Verify:**
   - ✅ `currentPlan` = "Pro Plan"
   - ✅ `planUpdatedAt` has recent timestamp
   - ✅ Record exists for your test store

### Test 4: Webhook Processing ✅

1. Complete subscription flow
2. Wait ~30 seconds for webhook delivery
3. Check server logs for:
   ```
   [Subscription Webhook] Received subscription update: { shop: '...', status: 'ACTIVE', name: 'Pro Plan' }
   [Subscription Webhook] Activating plan: Pro Plan for ...
   ```
4. **Verify:** Webhook was received and processed successfully

### Test 5: Billing Status API ✅

1. Navigate to `/app/pricing` after subscribing
2. Open browser DevTools → Network tab
3. Find the loader request
4. **Verify response:**
   ```json
   {
     "shop": "your-store.myshopify.com",
     "hasActivePayment": true,  // ← Should be true
     "plan": { ... },
     "planName": "Pro Plan"
   }
   ```
5. **Verify UI:**
   - ✅ Banner shows "Active Subscription"
   - ✅ Button shows "Already Subscribed" (disabled)

### Test 6: Protected Routes ✅

Create a test route to verify `requireBilling()`:

```typescript
// app/routes/app.test-protected.tsx
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { requireBilling } from "../utils/billing-check.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  await requireBilling(admin); // Will redirect if no subscription
  return json({ message: "You have access!" });
};

export default function TestProtected() {
  return <div>Protected content - you have a subscription!</div>;
}
```

**Test:**
1. Without subscription → redirects to `/app/pricing`
2. With subscription → shows "Protected content"

---

## Debugging

### Server Logs to Monitor

During testing, watch for these log patterns:

**Successful subscription:**
```
[Billing Request] Requesting plan: Pro Plan
→ Redirect to confirmation URL

[Billing Callback] User returned from billing: { shop, chargeId, plan }
[Billing Callback] Updated store plan to: Pro Plan

[Subscription Webhook] Received subscription update: { shop, status: 'ACTIVE', name: 'Pro Plan' }
[Subscription Webhook] Activating plan: Pro Plan for shop.myshopify.com
```

**Errors to watch for:**
```
[Billing Check] Error checking billing status
[Billing Request] Error requesting plan
[Subscription Webhook] No subscription data in payload
```

### Common Issues

#### Issue: Webhook not firing

**Symptoms:**
- Subscription completes but webhook never received
- No "[Subscription Webhook]" logs

**Check:**
1. Shopify CLI is running (`npm run dev`)
2. Tunnel is active (check CLI output for URL)
3. Webhook is registered in [shopify.app.toml:35-37](shopify.app.toml#L35-L37)
4. Route exists at `/webhooks/subscriptions/update`

**Debug:**
- Check Shopify admin → Settings → Notifications → Webhooks
- Look for "app_subscriptions/update" delivery attempts
- Check for error responses (404, 500, etc.)

#### Issue: Database not updating

**Symptoms:**
- Callback runs but `currentPlan` stays null
- Error in `[Billing Callback]` logs

**Check:**
1. `StoreInformation` record exists for the shop
2. `updateStorePlan()` function is being called
3. Prisma client is connected
4. Database migration is up to date

**Debug:**
```bash
# Check if store exists
npx prisma studio
# Look for shop in StoreInformation table

# Check migrations
npx prisma migrate status

# Re-run migrations if needed
npm run db:migrate
```

#### Issue: `requireBilling()` always redirects

**Symptoms:**
- Even with subscription, protected routes redirect
- `hasActivePayment` is always `false`

**Check:**
1. Plan name matches exactly ("Pro Plan")
2. Subscription is approved in Shopify (not just initiated)
3. `isTest: true` is set for development
4. Billing config is correct in [shopify.server.ts:21](app/shopify.server.ts#L21)

**Debug:**
```typescript
// Add to loader
const status = await getBillingStatus(admin);
console.log("Debug billing status:", status);
// Should show: { hasActivePayment: true, appSubscriptions: [...] }
```

#### Issue: Environment variables not loading

**Symptoms:**
- Verification script shows missing variables
- App fails to initialize

**Check:**
1. `.env` file exists in project root
2. Variables are not commented out
3. Server was restarted after changes

**Debug:**
```bash
# Check if .env is loaded
npm run dev
# Look for startup logs mentioning environment

# Manually verify
echo $SHOPIFY_API_KEY
```

---

## Integration Points Summary

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Subscription Flow                            │
└─────────────────────────────────────────────────────────────────┘

User visits /app/pricing
         ↓
    [Pricing Page]
    app.pricing.tsx
    - Displays plan details
    - Shows "Start Free Trial" button
         ↓
User clicks "Start Free Trial"
         ↓
    [POST Action]
    app.pricing.tsx (action)
    - Calls requestSubscription()
    - Gets confirmation URL
         ↓
Redirect to Shopify
         ↓
    [Shopify Billing]
    - User reviews subscription
    - Approves test charge
         ↓
Redirect to callback
         ↓
    [Billing Callback]
    app.billing.callback.tsx
    - Updates database
    - Sets currentPlan = "Pro Plan"
         ↓
Redirect to /app/dashboard?billing=success
         ↓
    [Webhook Async]
    webhooks.subscriptions.update.tsx
    - Receives ACTIVE status
    - Confirms plan activation
         ↓
    ✅ Subscription Active
```

### Database Flow

```
StoreInformation Table
├── shop (unique)
├── currentPlan ──────────> Updated by callback + webhook
├── planUpdatedAt ────────> Timestamp of last update
└── ...other fields
```

### API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/app/pricing` | GET | Display plans | Admin |
| `/app/pricing` | POST | Initiate subscription | Admin |
| `/app/billing/callback` | GET | Handle return from Shopify | Admin |
| `/webhooks/subscriptions/update` | POST | Process subscription events | Webhook (HMAC) |

---

## Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production` (disables test mode)
- [ ] Verify all environment variables are set
- [ ] Test billing flow on real Shopify store
- [ ] Verify webhooks are receiving events
- [ ] Set up monitoring/alerting for billing errors
- [ ] Test subscription cancellation flow
- [ ] Test trial expiration → paid conversion
- [ ] Verify database backups include billing data
- [ ] Document billing support procedures
- [ ] Test what happens when subscription expires

---

## Summary

Your billing integration is fully functional if:

1. ✅ `npm run billing:verify` passes all checks
2. ✅ Subscription flow completes without errors
3. ✅ Database updates with correct plan and timestamp
4. ✅ Webhooks are received and processed
5. ✅ `getBillingStatus()` returns correct values
6. ✅ `requireBilling()` properly protects routes
7. ✅ Shopify admin shows active subscription

**Next Steps:**
1. Run verification: `npm run billing:verify`
2. Test subscription in development store
3. Monitor logs during testing
4. Verify database with `npm run billing:status`
5. Check Shopify admin billing section

**For detailed testing guide, see:** [scripts/test-billing-integration.md](scripts/test-billing-integration.md)

**Support:**
- Shopify Billing API Docs: https://shopify.dev/docs/apps/billing
- Shopify App Bridge: https://shopify.dev/docs/api/app-bridge
- Prisma Docs: https://www.prisma.io/docs
