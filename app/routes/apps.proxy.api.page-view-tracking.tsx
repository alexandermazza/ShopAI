// shop-ai/app/routes/apps.proxy.api.page-view-tracking.tsx - App Proxy route for page view tracking
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { prisma } from "../db.server";

// This route is accessed via app proxy at /apps/proxy/api/page-view-tracking
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    let shop: string | undefined;
    let productId: string | undefined;
    
    try {
      const body = await request.json();
      shop = body.shop;
      productId = body.productId;
    } catch (e) {
      console.error("Error parsing JSON body:", e);
      return json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Resolve shop from multiple sources for robustness
    if (!shop) {
      // Prefer headers set by Shopify App Proxy
      shop = request.headers.get("X-Shopify-Shop-Domain") ||
             request.headers.get("x-shopify-shop-domain") || undefined;
    }
    if (!shop) {
      // Fallback to query param from proxy URL
      const url = new URL(request.url);
      shop = url.searchParams.get("shop") || undefined;
    }
    if (!shop) {
      return json({ error: "Missing shop parameter" }, { status: 400 });
    }

    // Get user agent from headers for optional tracking
    const userAgent = request.headers.get("User-Agent") || undefined;

    console.log("📊 Page view tracking:", { shop, productId, userAgent });

    // Record the page view
    await prisma.productPageView.create({
      data: {
        shop: shop,
        productId: productId,
        userAgent: userAgent,
        viewedAt: new Date(),
      },
    });

    console.log("✅ Page view tracked successfully");
    return json({ success: true, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error("❌ Error recording page view:", error);
    return json({ error: "Failed to record page view" }, { status: 500 });
  }
}

export async function loader() {
  return json({ status: "Page view tracking API endpoint is operational" });
}