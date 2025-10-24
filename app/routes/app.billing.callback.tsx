import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { updateStorePlan } from "../utils/plan-management.server";

/**
 * Callback route after user approves billing in Shopify admin
 * Shopify redirects here with charge_id and shop params
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const chargeId = url.searchParams.get("charge_id");
  const plan = url.searchParams.get("plan");

  console.log("[Billing Callback] User returned from billing:", {
    shop: session.shop,
    chargeId,
    plan,
  });

  // Update store plan in database if plan param is provided
  if (plan) {
    try {
      await updateStorePlan({
        shop: session.shop,
        plan,
      });
      console.log(`[Billing Callback] Updated store plan to: ${plan}`);
    } catch (error) {
      console.error("[Billing Callback] Error updating store plan:", error);
    }
  }

  // Redirect to dashboard with success message
  return redirect("/app/dashboard?billing=success");
};
