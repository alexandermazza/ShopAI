import { json } from "@remix-run/node";
import { verifyShopifyHmac } from "../shopify.server";

// Removed local verifyShopifyHmac function

export const action = async ({ request }) => {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  // Clone the request for HMAC verification because reading the body consumes it
  const isValid = await verifyShopifyHmac(request.clone(), secret);
  if (!isValid) {
    console.error("Webhook HMAC verification failed for CUSTOMERS_DATA_REQUEST"); // Added specific log
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const payload = await request.json();
    console.log("Received CUSTOMERS_DATA_REQUEST webhook:", payload); // Added specific log
    // TODO: Handle the data request (log, process, etc.)
  } catch (error) {
    console.error("Error processing CUSTOMERS_DATA_REQUEST webhook:", error); // Added specific log
    return json({ success: false, error: "Failed to process webhook" }, { status: 200 });
  }
  return json({ success: true });
}; 