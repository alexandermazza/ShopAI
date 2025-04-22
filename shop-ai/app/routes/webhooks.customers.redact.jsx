import { json } from "@remix-run/node";
import crypto from "crypto";

function verifyShopifyHmac(request, secret) {
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  if (!hmacHeader) return false;
  return request.text().then((body) => {
    const digest = crypto
      .createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("base64");
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  });
}

export const action = async ({ request }) => {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  const isValid = await verifyShopifyHmac(request.clone(), secret);
  if (!isValid) {
    return new Response("Unauthorized", { status: 401 });
  }
  const payload = await request.json();
  // TODO: Handle the customer data erasure (log, process, etc.)
  return json({ success: true });
}; 