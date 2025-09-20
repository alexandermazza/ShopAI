import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  console.log("📝 Auth route loader starting", { 
    url: request.url,
    shop,
    searchParams: Object.fromEntries(url.searchParams.entries())
  });
  
  try {
    console.log("📝 Auth route: Attempting authenticate.admin");
    const result = await authenticate.admin(request);
    console.log("✅ Auth route: Authentication successful", { 
      hasSession: !!result?.session,
      shop: result?.session?.shop,
      hasAdmin: !!result?.admin 
    });
    
    if (result instanceof Response) {
      console.log("📝 Auth route: Returning redirect response", {
        status: result.status,
        location: result.headers.get('location')
      });
      return result;
    }
    
    console.log("📝 Auth route: OAuth completed, session established");
    return json({ success: true, shop: result?.session?.shop });
  } catch (error) {
    console.error("❌ Auth route: Authentication error", { 
      message: error?.message || 'No error message',
      name: error?.name || 'No error name',
      stack: error?.stack || 'No stack trace',
      errorString: String(error),
      errorType: typeof error,
      url: request.url,
      shop,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      shopifyDomain: request.headers.get('x-shopify-shop-domain')
    });
    
    // If this is an installation error, try redirecting to login
    if (error.message?.includes('shop parameter is required') || 
        error.message?.includes('Invalid shop domain') ||
        error.message?.includes('session not found')) {
      console.log("📝 Auth route: Redirecting to login due to auth error");
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/auth/login${shop ? `?shop=${shop}` : ''}`
        }
      });
    }
    
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
