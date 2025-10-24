# ShopAI Billing Setup Guide

## Overview
ShopAI now has a complete Shopify Billing API integration that allows you to monetize your app with a **$15/month Pro Plan** including a **7-day free trial**.

## What Was Implemented

### 1. **Billing Configuration** (`app/utils/billing.server.ts`)
- Configured Pro Plan at $15/month with 7-day free trial
- Unlimited questions for Pro subscribers
- 100 questions/month limit for free tier

### 2. **Subscription Middleware** (`app/utils/billing-check.server.ts`)
- `requireBilling()` - Enforces subscription requirement
- `getBillingStatus()` - Checks current subscription status
- `requestSubscription()` - Initiates billing flow

### 3. **User Interface** (`app/routes/app.pricing.tsx`)
- Beautiful Polaris-based pricing page
- Clear feature breakdown
- One-click subscription with free trial

### 4. **Billing Flow**
1. User installs app
2. Dashboard shows "Subscription Required" banner
3. User clicks "View Pricing" → sees pricing page
4. User clicks "Start 7-Day Free Trial"
5. Redirected to Shopify billing confirmation
6. After approval → redirected back to `/app/billing/callback`
7. Subscription activated → unlimited questions enabled

### 5. **Webhook Handling** (`webhooks/subscriptions/update`)
- Tracks subscription status changes (ACTIVE, CANCELLED, EXPIRED)
- Automatically updates database when subscriptions change
- Configured in `shopify.app.toml`

### 6. **Database Schema** (Prisma)
Added new fields to `StoreInformation` model:
- `subscriptionId` - Shopify subscription ID
- `subscriptionStatus` - Current status (ACTIVE, CANCELLED, etc.)
- `trialEndsAt` - When free trial ends

## How to Test

### Development Mode (No Charges)
The billing system is set to **test mode** in development:
```typescript
isTest: process.env.NODE_ENV !== "production"
```

This means:
- ✅ You can test the full billing flow
- ✅ Shopify shows the confirmation UI
- ❌ No actual charges are made
- ✅ Works on development stores

### Testing Steps:
1. Run `npm run dev`
2. Install app on a development store
3. Navigate to the dashboard
4. Click "View Pricing"
5. Click "Start 7-Day Free Trial"
6. Approve in Shopify admin
7. You'll be redirected back with active subscription

## Production Deployment

### Before Deploying to Production:

#### 1. **Create Subscription Plans in Shopify Partners Dashboard**
   - Go to Shopify Partners → Apps → Your App → Pricing
   - Create a "Pro Plan" subscription:
     - Name: "Pro Plan"
     - Price: $15.00 USD
     - Billing interval: Every 30 days
     - Trial period: 7 days

#### 2. **Configure App Listing**
   - Set app pricing in Partners dashboard
   - Match plan names exactly with your code ("Pro Plan")
   - Configure trial period (7 days)

#### 3. **Environment Variables**
Make sure these are set in production:
```
NODE_ENV=production
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://shop-ai.fly.dev
DATABASE_URL=your_postgres_url
OPENAI_API_KEY=your_openai_key
```

#### 4. **Deploy to Fly.io**
```bash
npm run deploy
```

#### 5. **Verify Webhooks**
After deployment, verify in Shopify Partners that the subscription webhook is registered:
- Topic: `app_subscriptions/update`
- URL: `https://shop-ai.fly.dev/webhooks/subscriptions/update`

## How Users Experience Billing

### New User Flow:
1. **Install App** → Redirected to dashboard
2. **See Banner** → "Subscription Required - View Pricing"
3. **View Pricing** → Beautiful pricing page with features
4. **Start Trial** → One-click "Start 7-Day Free Trial" button
5. **Shopify Confirmation** → Shopify billing approval screen
6. **Approval** → Redirected back with success message
7. **Active Subscription** → Can use app with unlimited questions

### During Trial Period (7 Days):
- ✅ Full access to all features
- ✅ Unlimited questions
- ✅ No charges
- ⏰ Can cancel anytime

### After Trial:
- 💳 Automatically charged $15/month through Shopify
- 🔄 Subscription renews every 30 days
- ❌ Can cancel anytime (access continues until end of billing period)

### If Subscription Cancelled:
- 🔒 Reverts to free tier (100 questions/month)
- ⚠️ Dashboard shows warning banner
- 🔄 Can re-subscribe anytime

## Key Files Reference

**Billing Configuration:**
- `app/utils/billing.server.ts` - Plan definitions and pricing
- `app/utils/billing-check.server.ts` - Subscription middleware
- `app/utils/plan-management.server.ts` - Usage tracking

**Routes:**
- `app/routes/app.pricing.tsx` - Pricing page UI
- `app/routes/app.billing.callback.tsx` - Post-approval redirect
- `app/routes/webhooks.subscriptions.update.tsx` - Webhook handler
- `app/routes/app._index.jsx` - Dashboard with subscription banners

**Configuration:**
- `app/shopify.server.ts` - Shopify app with billing config
- `shopify.app.toml` - Webhook configuration
- `prisma/schema.prisma` - Database schema with billing fields

## Monitoring & Analytics

### Check Subscription Status:
```typescript
import { getBillingStatus } from "~/utils/billing-check.server";

const billingStatus = await getBillingStatus(admin);
console.log(billingStatus.hasActivePayment); // true/false
console.log(billingStatus.appSubscriptions); // subscription details
```

### Track Usage:
```typescript
import { incrementQuestionCount } from "~/utils/plan-management.server";

const result = await incrementQuestionCount(shop);
console.log(result.allowed); // true/false
console.log(result.remaining); // questions remaining (-1 for unlimited)
```

## Common Issues & Solutions

### Issue: "Billing API not working in development"
**Solution:** Make sure `isTest: true` is set in development mode

### Issue: "Subscription webhook not firing"
**Solution:** Check `shopify.app.toml` has the webhook configured and redeploy

### Issue: "Users can still use app without subscription"
**Solution:** Add `requireBilling()` middleware to protected routes

### Issue: "Free trial not showing"
**Solution:** Verify `trialDays: 7` is set in `PLAN_FEATURES` in `billing.server.ts`

## Next Steps

1. ✅ Test billing flow in development
2. ✅ Create production subscription plan in Shopify Partners
3. ✅ Deploy to production
4. ✅ Verify webhooks are working
5. ✅ Monitor first real subscription
6. 🔄 Optionally add usage-based billing later
7. 🔄 Add analytics dashboard for subscription metrics

## Support

For issues with Shopify billing:
- [Shopify Billing Documentation](https://shopify.dev/docs/apps/launch/billing)
- [Shopify App Remix Billing API](https://shopify.dev/docs/api/shopify-app-remix/v3/apis/billing)

---

**Congratulations!** Your ShopAI app can now accept payments and monetize effectively! 🎉
