import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { updateStorePlan } from "../utils/plan-management.server";

/**
 * Webhook handler for app subscription updates
 * Shopify sends this when a subscription is activated, updated, or cancelled
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { shop, payload } = await authenticate.webhook(request);

    console.log("[Subscription Webhook] Received subscription update:", {
      shop,
      status: payload.app_subscription?.status,
      name: payload.app_subscription?.name,
    });

    const subscription = payload.app_subscription;

    if (!subscription) {
      console.error("[Subscription Webhook] No subscription data in payload");
      return json({ error: "No subscription data" }, { status: 400 });
    }

    // Update store plan based on subscription status
    if (subscription.status === "ACTIVE") {
      const planName = subscription.name;
      console.log(`[Subscription Webhook] Activating plan: ${planName} for ${shop}`);

      await updateStorePlan({
        shop,
        plan: planName,
      });
    } else if (subscription.status === "CANCELLED" || subscription.status === "EXPIRED") {
      console.log(`[Subscription Webhook] Subscription ${subscription.status} for ${shop}, reverting to free`);

      // Revert to free plan - for now just log, you might want to update the plan
      // await updateStorePlan({ shop, plan: "Free Plan" });
    }

    return json({ success: true });
  } catch (error) {
    console.error("[Subscription Webhook] Error processing webhook:", error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
};
