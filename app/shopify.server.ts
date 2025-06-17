import {
  LATEST_API_VERSION,
  shopifyApp,
  LogSeverity, // Optional: For more detailed logging
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-04"; // Ensure this API version is appropriate for your app
import prisma from "./db.server"; // Make sure this path is correct and prisma is exported
import crypto from "crypto";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  appUrl: process.env.SHOPIFY_APP_URL || "",
  scopes: process.env.SCOPES?.split(","),
  apiVersion: LATEST_API_VERSION,
  restResources,
  sessionStorage: new PrismaSessionStorage(prisma),
  isEmbeddedApp: true, // Default to true for most Shopify apps
  // Example of more detailed logging, uncomment if needed:
  // logger: {
  //   level: LogSeverity.Debug,
  //   timestamps: true,
  // },
  // future: { 
  //   // future flags can be set here
  //   // v3_webhookAdminContext: true, // Example future flag
  // }, 
});

export default shopify;
export const apiVersion = LATEST_API_VERSION;
export const authenticate = shopify.authenticate; // This is the missing export

/**
 * Sets the necessary HTTP headers for Shopify app development.
 * This function is typically called in `entry.server.jsx` to ensure
 * security headers like Content-Security-Policy are correctly set.
 *
 * @param _request - The incoming Request object (currently unused but part of a standard signature).
 * @param responseHeaders - The Headers object to which the security headers will be added.
 */
export function addDocumentResponseHeaders(_request: Request, responseHeaders: Headers) {
  // Important: This is a simplified CSP for development.
  // For production, you MUST review and tighten this policy.
  // Consider using a nonce-based or hash-based approach for inline scripts and styles.
  // See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy
  responseHeaders.set(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com;"
    // Example of a stricter policy (you would need to manage nonces or hashes):
    // "default-src 'self'; script-src 'self' 'nonce-yourGeneratedNonce'; style-src 'self' 'nonce-yourGeneratedNonce'; img-src 'self' data: https://cdn.shopify.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://your-app-backend.example.com; frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com;"
  );
  responseHeaders.set("X-Frame-Options", "SAMEORIGIN");
  // Add other security headers as needed, e.g., X-Content-Type-Options, Referrer-Policy
}

/**
 * Verifies the HMAC signature of a Shopify webhook request.
 * @param request - The incoming Request object.
 * @param secret - The Shopify API secret for your app.
 * @returns A Promise that resolves to true if the HMAC is valid, false otherwise.
 */
export async function verifyShopifyHmac(request: Request, secret: string): Promise<boolean> {
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  console.log(`[HMAC Debug] Received x-shopify-hmac-sha256 header: ${hmacHeader}`);

  if (!hmacHeader) {
    console.error("[HMAC Error] HMAC verification failed: Missing x-shopify-hmac-sha256 header.");
    return false;
  }

  const body = await request.text();
  // Log only a portion of the body to avoid excessively large logs, especially in production.
  const bodyLogPortion = body.substring(0, Math.min(body.length, 500));
  console.log(`[HMAC Debug] Raw request body for HMAC (first 500 chars, total length ${body.length}): ${bodyLogPortion}${body.length > 500 ? '...' : ''}`);

  if (!body && body !== "") { // Allow explicitly empty string body, but not null/undefined if header is present
    console.error("[HMAC Error] HMAC verification failed: Request body is null or undefined, but HMAC header was present.");
    return false;
  }

  let generatedHmac;
  try {
    generatedHmac = crypto
      .createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("base64");
    console.log(`[HMAC Debug] Generated HMAC: ${generatedHmac}`);
  } catch (e) {
    console.error("[HMAC Error] Error during HMAC generation:", e);
    return false;
  }

  try {
    const hmacBuffer = Buffer.from(hmacHeader);
    const generatedHmacBuffer = Buffer.from(generatedHmac);

    if (hmacBuffer.length !== generatedHmacBuffer.length) {
      console.error(
        "[HMAC Error] HMAC verification failed: Signature length mismatch.",
        {
          headerHmac: hmacHeader,
          generatedHmac: generatedHmac,
        }
      );
      return false;
    }

    const isValid = crypto.timingSafeEqual(hmacBuffer, generatedHmacBuffer);
    if (!isValid) {
      console.error("[HMAC Error] HMAC verification failed: crypto.timingSafeEqual returned false.", {
        headerHmac: hmacHeader,
        generatedHmac: generatedHmac,
        // bodyUsed: bodyLogPortion + (body.length > 500 ? '...' : '') // Avoid re-logging potentially sensitive full body here
      });
      return false;
    }

    console.log("[HMAC Success] HMAC verification successful.");
    return true;
  } catch (error) {
    console.error("[HMAC Error] HMAC verification error during comparison (e.g., timingSafeEqual):", error, {
      headerHmac: hmacHeader,
      generatedHmac: generatedHmac, // This might be undefined if generation failed, but good to have
    });
    return false;
  }
}

/**
 * Registers all mandatory compliance webhooks for a given shop and access token.
 * Call this after app installation or shop onboarding.
 */
export async function registerMandatoryWebhooks({ shop, accessToken, appUrl }: { shop: string; accessToken: string; appUrl: string; }) {
  const topics = [
    "APP_UNINSTALLED",
    "SHOP_REDACT",
    "CUSTOMERS_DATA_REQUEST",
    "CUSTOMERS_REDACT",
  ];
  const endpoints = {
    APP_UNINSTALLED: "/webhooks.app.uninstalled",
    SHOP_REDACT: "/webhooks.shop.redact",
    CUSTOMERS_DATA_REQUEST: "/webhooks.customers.data_request",
    CUSTOMERS_REDACT: "/webhooks.customers.redact",
  };
  for (const topic of topics) {
    const response = await fetch(`https://${shop}/admin/api/${LATEST_API_VERSION}/webhooks.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhook: {
          topic,
          address: `${appUrl}${endpoints[topic as keyof typeof endpoints]}`,
          format: "json",
        },
      }),
    });
    if (!response.ok) {
      console.error(`[Webhook Registration] Failed to register webhook for topic ${topic}:`, await response.text());
    } else {
      console.log(`[Webhook Registration] Registered webhook for topic ${topic}`);
    }
  }
} 