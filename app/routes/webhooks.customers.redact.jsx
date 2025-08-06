import { json } from "@remix-run/node";
import { verifyShopifyHmac } from "../shopify.server";
import { prisma } from "../db.server";

export const action = async ({ request }) => {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  const isValid = await verifyShopifyHmac(request.clone(), secret);
  if (!isValid) {
    console.error("Webhook HMAC verification failed for CUSTOMERS_REDACT");
    return new Response("Unauthorized", { status: 401 });
  }
  
  try {
    const payload = await request.json();
    console.log("Received CUSTOMERS_REDACT webhook:", payload);
    
    // Extract customer information from the payload
    const { customer, orders = [], shop_domain } = payload;
    const customerId = customer?.id;
    const customerEmail = customer?.email;
    
    console.log(`Processing data redaction for customer ${customerId || 'unknown'} from shop ${shop_domain}`);
    
    // Delete customer sessions and related data
    if (customerId || customerEmail) {
      const deleteConditions = {
        shop: shop_domain,
        OR: []
      };
      
      if (customerEmail) {
        deleteConditions.OR.push({ email: customerEmail });
      }
      
      if (customerId) {
        deleteConditions.OR.push({ userId: BigInt(customerId) });
      }
      
      // Delete customer sessions
      const deletedSessions = await prisma.session.deleteMany({
        where: deleteConditions
      });
      
      console.log(`Deleted ${deletedSessions.count} customer sessions for redaction request`);
      
      // Log the redaction for compliance tracking
      console.log(`Successfully redacted data for customer ${customerId || customerEmail} from shop ${shop_domain}`);
    }
    
  } catch (error) {
    console.error("Error processing CUSTOMERS_REDACT webhook:", error);
    return json({ success: false, error: "Failed to process webhook" }, { status: 200 });
  }
  
  return json({ success: true });
}; 