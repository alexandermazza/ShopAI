import { authenticate, verifyShopifyHmac } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  const isValid = await verifyShopifyHmac(request.clone(), secret);
  if (!isValid) {
    console.error("Webhook HMAC verification failed for APP_UNINSTALLED");
    return new Response("Unauthorized", { status: 401 });
  }

  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
