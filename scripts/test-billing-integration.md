# Billing Integration Testing Guide

This guide provides step-by-step instructions to verify your billing integration is working correctly on the backend.

## Quick Verification

Run the automated verification script:

```bash
npx tsx scripts/verify-billing.ts
```

This will check:
- ✅ Environment variables
- ✅ Billing configuration
- ✅ Database connectivity
- ✅ Route implementation

---

## Backend Verification Checklist

### 1. Configuration Verification ✅

**What to check:**
- Billing config is properly defined in `shopify.server.ts`
- Plan details are correct in `billing.server.ts`

**Verified automatically by script:**
- Pro Plan: $15/month, 7-day trial
- Unlimited questions
- 6 features included

---

### 2. Webhook Verification ✅

**Webhook endpoint:** `/webhooks/subscriptions/update`

**Configured in:** `shopify.app.toml` (line 36-37)

**To test the webhook:**

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Trigger a test subscription in Shopify:**
   - Navigate to your app in Shopify admin
   - Go to `/app/pricing`
   - Click "Start Free Trial"
   - Approve the test charge

3. **Watch server logs for:**
   ```
   [Subscription Webhook] Received subscription update: { shop: '...', status: 'ACTIVE', name: 'Pro Plan' }
   [Subscription Webhook] Activating plan: Pro Plan for shop-name.myshopify.com
   ```

4. **Verify database update:**
   ```bash
   npx prisma studio
   ```
   - Open StoreInformation table
   - Check `currentPlan` field = "Pro Plan"
   - Check `planUpdatedAt` timestamp is recent

---

### 3. Billing Callback Route Verification ✅

**Endpoint:** `/app/billing/callback`

**What it does:**
- Receives redirect after merchant approves subscription
- Updates store plan in database
- Redirects to dashboard with success message

**To test:**

1. Complete a subscription flow (see Webhook section above)

2. **Watch for redirect:**
   - Should redirect to `/app/dashboard?billing=success`

3. **Check server logs:**
   ```
   [Billing Callback] User returned from billing: { shop: '...', chargeId: '...', plan: 'Pro Plan' }
   [Billing Callback] Updated store plan to: Pro Plan
   ```

4. **Verify in Prisma Studio:**
   ```bash
   npx prisma studio
   ```
   - StoreInformation → currentPlan should be "Pro Plan"

---

### 4. Billing Check Middleware Verification ✅

**Functions to test:**
- `requireBilling(admin, returnUrl?)` - Requires any paid plan
- `getBillingStatus(admin)` - Returns current billing status
- `requestSubscription(admin, plan, returnUrl)` - Initiates subscription

**Test without subscription:**

1. Create a test route (temporary):
   ```typescript
   // app/routes/app.test-billing.tsx
   import { json } from "@remix-run/node";
   import type { LoaderFunctionArgs } from "@remix-run/node";
   import { authenticate } from "../shopify.server";
   import { getBillingStatus, requireBilling } from "../utils/billing-check.server";

   export const loader = async ({ request }: LoaderFunctionArgs) => {
     const { admin, session } = await authenticate.admin(request);

     // Test 1: Get billing status (non-throwing)
     const status = await getBillingStatus(admin);
     console.log("[Test] Billing status:", status);

     // Test 2: Require billing (will redirect if not subscribed)
     await requireBilling(admin);

     return json({ message: "You have an active subscription!", status });
   };
   ```

2. **Without subscription:**
   - Navigate to `/app/test-billing`
   - Should redirect to `/app/pricing`
   - Logs: `hasActivePayment: false`

3. **With subscription:**
   - Complete subscription flow first
   - Navigate to `/app/test-billing`
   - Should show "You have an active subscription!"
   - Logs: `hasActivePayment: true`

---

### 5. Database Integration Verification ✅

**Verify plan updates are persisted:**

```bash
# Query the database directly
npx prisma db execute --stdin <<EOF
SELECT shop, "currentPlan", "planUpdatedAt", "createdAt"
FROM "StoreInformation"
ORDER BY "planUpdatedAt" DESC;
EOF
```

**Expected output (after subscription):**
```
shop                    | currentPlan | planUpdatedAt              | createdAt
------------------------|-------------|----------------------------|---------------------------
your-store.myshopify.com| Pro Plan    | 2025-10-23T12:34:56.789Z  | 2025-10-23T10:00:00.000Z
```

**Check plan management functions:**

```bash
# Open Prisma Studio
npx prisma studio
```

Navigate to StoreInformation table and verify:
- `currentPlan` column exists
- `planUpdatedAt` column exists
- Updates are timestamped correctly

---

### 6. API Response Verification ✅

**Test the pricing page API:**

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser DevTools → Network tab**

3. **Navigate to `/app/pricing`**

4. **Check loader response:**
   ```json
   {
     "shop": "your-store.myshopify.com",
     "hasActivePayment": false,
     "plan": {
       "monthlyQuestions": -1,
       "features": [...],
       "priority": "high",
       "price": 15,
       "trialDays": 7
     },
     "planName": "Pro Plan"
   }
   ```

5. **After subscribing, reload page:**
   ```json
   {
     "shop": "your-store.myshopify.com",
     "hasActivePayment": true,  // ← Should be true
     "plan": { ... },
     "planName": "Pro Plan"
   }
   ```

---

### 7. Shopify Admin Verification ✅

**Verify subscription shows in Shopify:**

1. Go to Shopify admin
2. Settings → Apps and sales channels
3. Click on your app name
4. Click "View details" or "Manage"
5. Look for billing section showing:
   - Status: "Active" or "In trial"
   - Plan: "Pro Plan"
   - Amount: "$15.00 USD every 30 days"

---

## Backend Logs to Monitor

When testing, watch for these log messages:

### ✅ Successful Subscription Flow

```
[Billing Request] Requesting plan: Pro Plan
→ Redirect to Shopify confirmation page

[Billing Callback] User returned from billing: { shop: '...', chargeId: '...', plan: 'Pro Plan' }
[Billing Callback] Updated store plan to: Pro Plan
→ Redirect to /app/dashboard?billing=success

[Subscription Webhook] Received subscription update: { shop: '...', status: 'ACTIVE', name: 'Pro Plan' }
[Subscription Webhook] Activating plan: Pro Plan for ...
```

### ❌ Error Scenarios to Test

**No subscription (accessing protected route):**
```
[Billing Check] Error checking billing status: ...
→ Redirect to /app/pricing
```

**Invalid plan requested:**
```
[Billing Request] Error requesting plan Invalid Plan: Invalid plan: Invalid Plan
```

**Webhook missing subscription data:**
```
[Subscription Webhook] No subscription data in payload
```

---

## Integration Test Scenarios

### Scenario 1: New Merchant Installation

1. ✅ Install app on test store
2. ✅ Navigate to `/app/pricing`
3. ✅ Verify "Start Free Trial" button shows
4. ✅ Click button → redirect to Shopify confirmation
5. ✅ Approve test charge
6. ✅ Redirect to `/app/dashboard?billing=success`
7. ✅ Verify database shows `currentPlan = "Pro Plan"`
8. ✅ Webhook received and processed
9. ✅ Banner shows "Active Subscription"

### Scenario 2: Existing Merchant (Already Subscribed)

1. ✅ Merchant has active subscription
2. ✅ Navigate to `/app/pricing`
3. ✅ Banner shows "Active Subscription"
4. ✅ Button shows "Already Subscribed" (disabled)
5. ✅ Database shows `currentPlan = "Pro Plan"`

### Scenario 3: Subscription Cancellation

1. ✅ Merchant cancels subscription in Shopify admin
2. ✅ Webhook fires: `status: "CANCELLED"`
3. ✅ Server logs: "[Subscription Webhook] Subscription CANCELLED for ..."
4. ✅ Plan remains "Pro Plan" until expiry (grace period)
5. ✅ After expiry, webhook fires: `status: "EXPIRED"`

### Scenario 4: Trial Expiration

1. ✅ Trial period ends (7 days)
2. ✅ Shopify charges merchant automatically
3. ✅ Webhook fires: `status: "ACTIVE"` (trial → paid)
4. ✅ Database maintains `currentPlan = "Pro Plan"`

---

## Troubleshooting

### Issue: Webhook not receiving events

**Check:**
- Shopify CLI is running (`npm run dev`)
- Tunnel is active and publicly accessible
- Webhook is registered in `shopify.app.toml`
- Route exists at `/webhooks/subscriptions/update`

**Debug:**
```bash
# Check webhook deliveries in Shopify admin
# Settings → Notifications → Webhooks
# Look for "app_subscriptions/update" deliveries
```

### Issue: Database not updating after subscription

**Check:**
- `updateStorePlan` function is called in callback route
- Prisma client is connected
- `StoreInformation` record exists for the shop

**Debug:**
```bash
# Check if store record exists
npx prisma studio
# Manually create one if missing
```

### Issue: `requireBilling` always redirects

**Check:**
- Subscription is actually approved in Shopify
- Billing config plan name matches subscription name exactly
- `isTest: true` is set for development mode

**Debug:**
```typescript
const status = await getBillingStatus(admin);
console.log("Billing status:", status);
// Should show hasActivePayment: true
```

### Issue: Environment variables not loading

**Check:**
- `.env` file exists in project root
- Variables are not commented out
- Server was restarted after adding variables

**Debug:**
```bash
# Verify in dev server
npm run dev
# Check startup logs for environment variables
```

---

## Summary

Your billing integration is working correctly if:

1. ✅ Verification script passes all checks
2. ✅ Subscription flow completes without errors
3. ✅ Database updates with correct plan and timestamp
4. ✅ Webhooks are received and processed
5. ✅ Billing status checks return correct values
6. ✅ Protected routes redirect when no subscription
7. ✅ Shopify admin shows active subscription

**Next Steps:**
- Run the verification script: `npx tsx scripts/verify-billing.ts`
- Test subscription flow in development store
- Monitor server logs during testing
- Verify database updates in Prisma Studio
- Check Shopify admin for subscription status

**For production deployment:**
- Set `NODE_ENV=production` to disable test mode
- Verify all environment variables are set
- Test with real Shopify store
- Monitor webhook deliveries
- Set up error alerting for billing failures
