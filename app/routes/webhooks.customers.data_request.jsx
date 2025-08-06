import { json } from "@remix-run/node";
import { verifyShopifyHmac } from "../shopify.server";
import { prisma } from "../db.server";

export const action = async ({ request }) => {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  // Clone the request for HMAC verification because reading the body consumes it
  const isValid = await verifyShopifyHmac(request.clone(), secret);
  if (!isValid) {
    console.error("Webhook HMAC verification failed for CUSTOMERS_DATA_REQUEST");
    return new Response("Unauthorized", { status: 401 });
  }
  
  try {
    const payload = await request.json();
    console.log("Received CUSTOMERS_DATA_REQUEST webhook:", payload);
    
    // Extract customer information from the payload
    const { customer, orders = [], shop_domain } = payload;
    
    // Log the data request for compliance tracking
    console.log(`Data request for customer ${customer?.id || 'unknown'} from shop ${shop_domain}`);
    
    // Query any stored customer data from our database
    const customerSessions = await prisma.session.findMany({
      where: {
        shop: shop_domain,
        OR: [
          { email: customer?.email },
          { userId: customer?.id ? BigInt(customer.id) : undefined }
        ].filter(Boolean)
      }
    });
    
    // Prepare the data response (in real implementation, you would send this to the store owner)
    const customerData = {
      customer_id: customer?.id,
      email: customer?.email,
      stored_sessions: customerSessions.map(session => ({
        id: session.id,
        email: session.email,
        firstName: session.firstName,
        lastName: session.lastName,
        locale: session.locale,
        created: session.expires
      })),
      request_id: payload.data_request?.id,
      shop_domain: shop_domain
    };
    
    // In a production app, you would need to:
    // 1. Store this request for tracking
    // 2. Send the data to the store owner via email or API
    // 3. Complete the request within 30 days
    console.log("Customer data for GDPR request:", customerData);
    
  } catch (error) {
    console.error("Error processing CUSTOMERS_DATA_REQUEST webhook:", error);
    return json({ success: false, error: "Failed to process webhook" }, { status: 200 });
  }
  
  return json({ success: true });
}; 