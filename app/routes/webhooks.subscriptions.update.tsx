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
        subscriptionStatus: "ACTIVE",
      });
    } else if (subscription.status === "CANCELLED" || subscription.status === "EXPIRED") {
      console.log(`[Subscription Webhook] Subscription ${subscription.status} for ${shop}, reverting to Free Plan`);

      await updateStorePlan({
        shop,
        plan: "Free Plan",
        subscriptionStatus: subscription.status,
      });
    } else if (subscription.status === "FROZEN" || subscription.status === "PENDING") {
      // Handle other statuses - keep current plan but update status
      console.log(`[Subscription Webhook] Subscription status ${subscription.status} for ${shop}`);

      await updateStorePlan({
        shop,
        plan: subscription.name,
        subscriptionStatus: subscription.status,
      });
    }

    return json({ success: true });
  } catch (error) {
    console.error("[Subscription Webhook] Error processing webhook:", error);
    return json({ error: "Webhook processing failed" }, { status: 500 });
  }
};
