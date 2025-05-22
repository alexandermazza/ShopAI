import crypto from "crypto";

/**
 * Verifies the HMAC signature of a Shopify webhook request.
 * @param request - The incoming Request object.
 * @param secret - The Shopify API secret for your app.
 * @returns A Promise that resolves to true if the HMAC is valid, false otherwise.
 */
export async function verifyShopifyHmac(request: Request, secret: string): Promise<boolean> {
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  if (!hmacHeader) {
    console.error("HMAC verification failed: Missing x-shopify-hmac-sha256 header.");
    return false;
  }

  // Important: We need to get the raw body as text to generate the HMAC.
  // request.json() would parse it and change the content, leading to HMAC mismatch.
  const body = await request.text();
  if (!body) {
    console.error("HMAC verification failed: Request body is empty.");
    // If the body is empty, Shopify might send a specific HMAC for an empty string.
    // However, typically for POST requests with data, an empty body when a signature is present is suspicious.
    // For now, we'll treat it as a failure, but this might need adjustment based on Shopify's exact behavior for all webhook types.
    return false;
  }

  const generatedHmac = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8") // Ensure 'utf8' encoding for the body string
    .digest("base64");

  try {
    // Use crypto.timingSafeEqual to prevent timing attacks
    // Both buffers must be the same length for timingSafeEqual to work correctly.
    const hmacBuffer = Buffer.from(hmacHeader);
    const generatedHmacBuffer = Buffer.from(generatedHmac);

    if (hmacBuffer.length !== generatedHmacBuffer.length) {
      console.error(
        "HMAC verification failed: Signature length mismatch.",
        {
          headerLength: hmacBuffer.length,
          generatedLength: generatedHmacBuffer.length,
        }
      );
      return false;
    }

    return crypto.timingSafeEqual(hmacBuffer, generatedHmacBuffer);
  } catch (error) {
    console.error("HMAC verification error during timingSafeEqual:", error);
    return false;
  }
} 