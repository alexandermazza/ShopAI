import { json } from "@remix-run/node";
import { verifyShopifyHmac } from "../shopify.server";

export const action = async ({ request }) => {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  // Clone the request for HMAC verification because reading the body consumes it
  const isValid = await verifyShopifyHmac(request.clone(), secret);

  if (!isValid) {
    console.error("Webhook HMAC verification failed for SHOP_UPDATE");
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await request.json();
    console.log("Received SHOP_UPDATE webhook:", payload);
    // TODO: Handle the shop update logic (e.g., update shop information in your database)
    // Example: await db.shop.update({ where: { shopifyId: payload.id }, data: { ... } });
  } catch (error) {
    console.error("Error processing SHOP_UPDATE webhook:", error);
    // Still return 200 to Shopify if HMAC was valid but processing failed,
    // to prevent Shopify from retrying indefinitely for a processing error.
    // Log the error for investigation.
    return json({ success: false, error: "Failed to process webhook" }, { status: 200 });
  }

  return json({ success: true });
}; 