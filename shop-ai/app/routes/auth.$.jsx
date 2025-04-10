import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  console.log("📝 Auth route loader starting", { url: request.url });
  
  try {
    console.log("📝 Auth route: Attempting authenticate.admin");
    await authenticate.admin(request);
    console.log("✅ Auth route: Authentication successful");
    return null;
  } catch (error) {
    console.error("❌ Auth route: Authentication error", { 
      message: error.message,
      stack: error.stack,
      url: request.url,
      headers: Object.fromEntries([...request.headers.entries()].filter(([key]) => !['cookie', 'authorization'].includes(key.toLowerCase())))
    });
    
    // Don't hide the error - let it propagate to trigger the standard error handling
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
