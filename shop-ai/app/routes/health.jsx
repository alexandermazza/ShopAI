import { json } from "@remix-run/node";

export const loader = async () => {
  return json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
};

export function headers() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };
} 