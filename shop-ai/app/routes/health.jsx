import { json } from "@remix-run/node";

export const loader = async () => {
  return json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    appUrl: process.env.SHOPIFY_APP_URL || "Not set",
    services: {
      openai: process.env.OPENAI_API_KEY ? "configured" : "not configured",
      database: process.env.DATABASE_URL ? "configured" : "not configured",
    },
  });
};

export function headers() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };
}

export default function Health() {
  return null;
} 