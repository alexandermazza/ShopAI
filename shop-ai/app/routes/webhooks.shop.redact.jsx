import { json } from "@remix-run/node";
import { verifyShopifyHmac } from "../shopify.server";
import { prisma } from "../db.server";

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
    
    // Extract shop information from the payload
    const { shop_id, shop_domain } = payload;
    
    console.log(`Processing shop data redaction for shop ${shop_domain} (ID: ${shop_id})`);
    
    // Delete all data associated with this shop
    // This webhook is sent 48 hours after app uninstallation
    
    // Delete all sessions for this shop
    const deletedSessions = await prisma.session.deleteMany({
      where: {
        shop: shop_domain
      }
    });
    
    // Delete store information for this shop
    const deletedStoreInfo = await prisma.storeInformation.deleteMany({
      where: {
        shop: shop_domain
      }
    });
    
    console.log(`Shop redaction completed for ${shop_domain}:`);
    console.log(`- Deleted ${deletedSessions.count} sessions`);
    console.log(`- Deleted ${deletedStoreInfo.count} store information records`);
    
    // Log the redaction for compliance tracking
    console.log(`Successfully redacted all data for shop ${shop_domain} (ID: ${shop_id})`);
    
  } catch (error) {
    console.error("Error processing SHOP_REDACT webhook:", error);
    return json({ success: false, error: "Failed to process webhook" }, { status: 200 });
  }
  
  return json({ success: true });
}; 