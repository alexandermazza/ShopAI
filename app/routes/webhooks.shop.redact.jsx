import { json } from "@remix-run/node";
import { verifyShopifyHmac } from "../shopify.server";

export const action = async ({ request }) => {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  const isValid = await verifyShopifyHmac(request.clone(), secret);
  if (!isValid) {
    console.error("Webhook HMAC verification failed for SHOP_REDACT");
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const payload = await request.json();
    console.log("Received SHOP_REDACT webhook:", payload);
    // TODO: Handle the shop data erasure (log, process, etc.)
  } catch (error) {
    console.error("Error processing SHOP_REDACT webhook:", error);
    return json({ success: false, error: "Failed to process webhook" }, { status: 200 });
  }
  return json({ success: true });
}; 