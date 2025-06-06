import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  console.log("📝 Auth route loader starting", { url: request.url });
  
  try {
    console.log("📝 Auth route: Attempting authenticate.admin");
    const result = await authenticate.admin(request);
    console.log("✅ Auth route: Authentication successful", { 
      hasSession: !!result?.session,
      shop: result?.session?.shop,
      hasAdmin: !!result?.admin 
    });
    
    if (result instanceof Response) {
      console.log("📝 Auth route: Returning redirect response");
      return result;
    }
    
    console.log("📝 Auth route: OAuth completed, session established");
    return json({ success: true, shop: result?.session?.shop });
  } catch (error) {
    console.error("❌ Auth route: Authentication error", { 
      message: error.message,
      stack: error.stack,
      url: request.url,
      headers: Object.fromEntries([...request.headers.entries()].filter(([key]) => !['cookie', 'authorization'].includes(key.toLowerCase())))
    });
    
    throw error;
  }
};

export function headers() {
  console.log("📝 Auth route: headers function called");
  return {
    "Content-Security-Policy": "frame-ancestors 'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com",
    "X-Frame-Options": "SAMEORIGIN",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "X-Requested-With, Content-Type, Accept"
  };
}
