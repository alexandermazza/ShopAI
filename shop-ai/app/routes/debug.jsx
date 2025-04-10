import { json } from "@remix-run/node";
import prisma from "../db.server";

export const loader = async () => {
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