import { json } from "@remix-run/node";
import { prisma } from "../db.server";

export const loader = async ({ request }) => {
  // Security check - only allow in non-production or with debug key
  const headers = Object.fromEntries(request.headers);
  
  if (
    process.env.NODE_ENV === "production" && 
    headers["x-debug-key"] !== process.env.DEBUG_SECRET
  ) {
    return json(
      { error: "Not authorized for debug info in production" },
      { status: 403 }
    );
  }

  let databaseStatus = "Unknown";
  let error = null;
  
  try {
    // Test database connection by trying to access a table
    await prisma.$queryRaw`SELECT 1`;
    databaseStatus = "Connected";
  } catch (e) {
    databaseStatus = "Error";
    error = e.message;
  }
  
  // Get environment variables (without exposing secrets)
  const envInfo = {
    NODE_ENV: process.env.NODE_ENV,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
    SCOPES: process.env.SCOPES,
    API_KEY_SET: !!process.env.SHOPIFY_API_KEY,
    API_SECRET_SET: !!process.env.SHOPIFY_API_SECRET,
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DIRECT_URL_SET: !!process.env.DIRECT_URL,
  };
  
  // Return debugging information
  return json({
    timestamp: new Date().toISOString(),
    database: {
      status: databaseStatus,
      error: error,
    },
    environment: envInfo,
    request: {
      method: request.method,
      url: request.url,
      headers: headers
    },
    headers: {
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': "frame-ancestors 'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com"
    }
  });
};

// Export headers to allow cross-origin access
export function headers() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Cache-Control": "no-store"
  };
}

export default function Debug() {
  return null;
} 