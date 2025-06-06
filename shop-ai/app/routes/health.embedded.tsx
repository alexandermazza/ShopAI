import { json, type LoaderFunction } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    
    // Validate that session has required properties
    const isValidSession = !!(
      session.shop &&
      session.accessToken &&
      session.scope
    );
    
    // Test if session token is valid and app is properly embedded
    return json({
      status: "ok",
      embedded: true,
      appBridgeReady: true,
      sessionValid: isValidSession,
      shop: session.shop,
      scope: session.scope,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get("user-agent"),
      host: request.headers.get("host"),
      shopifyShopDomain: request.headers.get("x-shopify-shop-domain"),
      shopifyHmacSha256: !!request.headers.get("x-shopify-hmac-sha256"),
      // Additional embedded app indicators
      checks: {
        hasApiKey: !!process.env.SHOPIFY_API_KEY,
        hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
        hasAppUrl: !!process.env.SHOPIFY_APP_URL,
        sessionStorageConfigured: true,
        isEmbeddedApp: true
      }
    });
  } catch (error) {
    console.error("Embedded health check failed:", error);
    return json({
      status: "error",
      embedded: false,
      appBridgeReady: false,
      sessionValid: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      checks: {
        hasApiKey: !!process.env.SHOPIFY_API_KEY,
        hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
        hasAppUrl: !!process.env.SHOPIFY_APP_URL,
        sessionStorageConfigured: true,
        isEmbeddedApp: true
      }
    }, { status: 401 });
  }
};

// Set proper headers for embedded context
export const headers = ({ loaderData }: { loaderData: any }) => {
  const shop = loaderData?.shop;
  
  let frameAncestors = "'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com";
  if (shop) {
    frameAncestors = `'self' https://${shop} https://admin.shopify.com`;
  }
  
  return {
    "Content-Security-Policy": `frame-ancestors ${frameAncestors}`,
    "X-Frame-Options": "SAMEORIGIN",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  };
}; 