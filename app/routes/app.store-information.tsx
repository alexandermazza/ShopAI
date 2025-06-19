import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";
// @ts-ignore - db.server.js is a JavaScript file
import prisma from "../db.server.js";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  try {
    console.log("🔍 Loading store info for shop:", session.shop);
    const storeInfo = await prisma.storeInformation.findUnique({
      where: { shop: session.shop }
    });
    console.log("📊 Store info found:", storeInfo ? "Yes" : "No", storeInfo ? `(${Object.keys(storeInfo).length} fields)` : "");
    
    return json({ storeInfo });
  } catch (error) {
    console.error("❌ Error loading store information:", error);
    return json({ storeInfo: null, error: "Failed to load store information" });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let requestData: any;
  try {
    requestData = await request.json();
  } catch (e) {
    console.error("Failed to parse request JSON:", e);
    return json({ error: "Invalid request format" }, { status: 400 });
  }

  const {
    storeName,
    storeDescription,
    shippingPolicy,
    returnPolicy,
    storeHours,
    contactInfo,
    specialServices,
    aboutUs,
    additionalInfo
  } = requestData;

  try {
    console.log("💾 Saving store info for shop:", session.shop);
    console.log("📝 Data being saved:", { storeName, storeDescription: storeDescription?.length || 0 });
    
    const storeInfo = await prisma.storeInformation.upsert({
      where: { shop: session.shop },
      update: {
        storeName,
        storeDescription,
        shippingPolicy,
        returnPolicy,
        storeHours,
        contactInfo,
        specialServices,
        aboutUs,
        additionalInfo,
        updatedAt: new Date()
      },
      create: {
        shop: session.shop,
        storeName,
        storeDescription,
        shippingPolicy,
        returnPolicy,
        storeHours,
        contactInfo,
        specialServices,
        aboutUs,
        additionalInfo
      }
    });

    console.log("✅ Store info saved successfully for shop:", session.shop);
    return json({ success: true, storeInfo });
  } catch (error) {
    console.error("❌ Error saving store information:", error);
    return json({ error: "Failed to save store information" }, { status: 500 });
  }
} 