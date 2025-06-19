var _a;
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer, Meta, Links, Outlet, ScrollRestoration, Scripts, useLoaderData, useActionData, Form, Link, useRouteError, useFetcher } from "@remix-run/react";
import { createReadableStreamFromReadable, json, redirect } from "@remix-run/node";
import { isbot } from "isbot";
import { shopifyApp, LATEST_API_VERSION, LoginErrorType, boundary } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { restResources } from "@shopify/shopify-api/rest/admin/2024-04";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import OpenAI from "openai";
import { openai as openai$3 } from "@ai-sdk/openai";
import { streamText } from "ai";
import { useState, useCallback, useEffect } from "react";
import { AppProvider, Page, Card, FormLayout, Text, TextField, Button, Layout, BlockStack, Link as Link$1, List, Box, Tabs, InlineStack, Badge, Banner } from "@shopify/polaris";
import { AppProvider as AppProvider$1 } from "@shopify/shopify-app-remix/react";
import { NavMenu, TitleBar, useAppBridge } from "@shopify/app-bridge-react";
let prisma;
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({
      log: ["query", "error", "warn"]
    });
  }
  prisma = global.prismaGlobal;
}
prisma.$connect().catch((e) => {
  console.error("Failed to connect to the database:", e);
  if (process.env.SKIP_BUILD_SCRIPT !== "true") {
    throw e;
  }
});
const prisma$1 = prisma;
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  appUrl: process.env.SHOPIFY_APP_URL || "",
  scopes: (_a = process.env.SCOPES) == null ? void 0 : _a.split(","),
  apiVersion: LATEST_API_VERSION,
  restResources,
  sessionStorage: new PrismaSessionStorage(prisma$1),
  isEmbeddedApp: true
  // Default to true for most Shopify apps
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
const authenticate = shopify.authenticate;
function addDocumentResponseHeaders(_request, responseHeaders) {
  responseHeaders.set(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com;"
    // Example of a stricter policy (you would need to manage nonces or hashes):
    // "default-src 'self'; script-src 'self' 'nonce-yourGeneratedNonce'; style-src 'self' 'nonce-yourGeneratedNonce'; img-src 'self' data: https://cdn.shopify.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://your-app-backend.example.com; frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com;"
  );
  responseHeaders.set("X-Frame-Options", "SAMEORIGIN");
}
async function verifyShopifyHmac(request, secret) {
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  console.log(`[HMAC Debug] Received x-shopify-hmac-sha256 header: ${hmacHeader}`);
  if (!hmacHeader) {
    console.error("[HMAC Error] HMAC verification failed: Missing x-shopify-hmac-sha256 header.");
    return false;
  }
  const body = await request.text();
  const bodyLogPortion = body.substring(0, Math.min(body.length, 500));
  console.log(`[HMAC Debug] Raw request body for HMAC (first 500 chars, total length ${body.length}): ${bodyLogPortion}${body.length > 500 ? "..." : ""}`);
  if (!body && body !== "") {
    console.error("[HMAC Error] HMAC verification failed: Request body is null or undefined, but HMAC header was present.");
    return false;
  }
  let generatedHmac;
  try {
    generatedHmac = crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64");
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
          generatedHmac
        }
      );
      return false;
    }
    const isValid = crypto.timingSafeEqual(hmacBuffer, generatedHmacBuffer);
    if (!isValid) {
      console.error("[HMAC Error] HMAC verification failed: crypto.timingSafeEqual returned false.", {
        headerHmac: hmacHeader,
        generatedHmac
        // bodyUsed: bodyLogPortion + (body.length > 500 ? '...' : '') // Avoid re-logging potentially sensitive full body here
      });
      return false;
    }
    console.log("[HMAC Success] HMAC verification successful.");
    return true;
  } catch (error) {
    console.error("[HMAC Error] HMAC verification error during comparison (e.g., timingSafeEqual):", error, {
      headerHmac: hmacHeader,
      generatedHmac
      // This might be undefined if generation failed, but good to have
    });
    return false;
  }
}
const streamTimeout = 5e3;
async function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(RemixServer, { context: remixContext, url: request.url }),
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        }
      }
    );
    setTimeout(abort, streamTimeout + 1e3);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
const meta = () => {
  return [
    { title: "ShopAI App" },
    { name: "viewport", content: "width=device-width,initial-scale=1" }
  ];
};
const loader$f = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  return {
    shop
  };
};
const headers$5 = ({ loaderData }) => {
  const shop = loaderData == null ? void 0 : loaderData.shop;
  let frameAncestors = "'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com";
  if (shop) {
    frameAncestors = `'self' https://${shop} https://admin.shopify.com`;
  }
  return {
    "Content-Security-Policy": `frame-ancestors ${frameAncestors}`,
    "X-Frame-Options": "SAMEORIGIN"
  };
};
function App$2() {
  return /* @__PURE__ */ jsxs("html", { children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width,initial-scale=1" }),
      /* @__PURE__ */ jsx("meta", { httpEquiv: "Content-Security-Policy", content: "frame-ancestors 'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com" }),
      /* @__PURE__ */ jsx("link", { rel: "preconnect", href: "https://cdn.shopify.com/" }),
      /* @__PURE__ */ jsx(
        "link",
        {
          rel: "stylesheet",
          href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        }
      ),
      /* @__PURE__ */ jsx(
        "script",
        {
          src: "https://cdn.shopify.com/shopifycloud/app-bridge/app-bridge.js",
          defer: true
        }
      ),
      /* @__PURE__ */ jsx(Meta, {}),
      /* @__PURE__ */ jsx(Links, {})
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsx(Outlet, {}),
      /* @__PURE__ */ jsx(ScrollRestoration, {}),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: App$2,
  headers: headers$5,
  loader: loader$f,
  meta
}, Symbol.toStringTag, { value: "Module" }));
const action$d = async ({ request }) => {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  const isValid = await verifyShopifyHmac(request.clone(), secret);
  if (!isValid) {
    console.error("Webhook HMAC verification failed for CUSTOMERS_DATA_REQUEST");
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const payload = await request.json();
    console.log("Received CUSTOMERS_DATA_REQUEST webhook:", payload);
  } catch (error) {
    console.error("Error processing CUSTOMERS_DATA_REQUEST webhook:", error);
    return json({ success: false, error: "Failed to process webhook" }, { status: 200 });
  }
  return json({ success: true });
};
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$d
}, Symbol.toStringTag, { value: "Module" }));
const action$c = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;
  if (session) {
    await prisma$1.session.update({
      where: {
        id: session.id
      },
      data: {
        scope: current.toString()
      }
    });
  }
  return new Response();
};
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$c
}, Symbol.toStringTag, { value: "Module" }));
const action$b = async ({ request }) => {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  const isValid = await verifyShopifyHmac(request.clone(), secret);
  if (!isValid) {
    console.error("Webhook HMAC verification failed for CUSTOMERS_REDACT");
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const payload = await request.json();
    console.log("Received CUSTOMERS_REDACT webhook:", payload);
  } catch (error) {
    console.error("Error processing CUSTOMERS_REDACT webhook:", error);
    return json({ success: false, error: "Failed to process webhook" }, { status: 200 });
  }
  return json({ success: true });
};
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$b
}, Symbol.toStringTag, { value: "Module" }));
const action$a = async ({ request }) => {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  const isValid = await verifyShopifyHmac(request.clone(), secret);
  if (!isValid) {
    console.error("Webhook HMAC verification failed for APP_UNINSTALLED");
    return new Response("Unauthorized", { status: 401 });
  }
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  if (session) {
    await prisma$1.session.deleteMany({ where: { shop } });
  }
  return new Response();
};
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$a
}, Symbol.toStringTag, { value: "Module" }));
const openai$2 = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});
async function action$9({ request }) {
  var _a2, _b, _c;
  if (request.method !== "POST") {
    console.error("Error: Method not allowed");
    return new Response("Error: Method not allowed\n", { status: 405, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  let scrapedReviews;
  let toneOfVoice;
  try {
    const body = await request.json();
    console.log("Received request body:", body);
    scrapedReviews = body.scrapedReviews;
    toneOfVoice = body.toneOfVoice;
    console.log("Received scrapedReviews:", scrapedReviews);
    console.log("Received toneOfVoice:", toneOfVoice);
  } catch (e) {
    console.error("Error parsing JSON body:", e);
    return new Response("Error: Invalid JSON body\n", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (!scrapedReviews) {
    console.error("Missing scraped review content");
    return new Response("Error: Missing scraped review content\n", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const MAX_REVIEW_TEXT_LENGTH = 6e3;
  if (scrapedReviews.length > MAX_REVIEW_TEXT_LENGTH) {
    console.error(`Review content exceeds maximum length: ${scrapedReviews.length}`);
    return new Response(`Error: Review content exceeds maximum length of ${MAX_REVIEW_TEXT_LENGTH} characters.
`, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  try {
    const toneInstructions = {
      professional: "Use a professional and neutral tone.",
      friendly: "Use a friendly and conversational tone.",
      playful: "Use a playful and witty tone.",
      minimalist: "Be extremely concise, like a TL;DR.",
      luxury: "Use a luxurious, high-end tone.",
      hype: "Use hype, trendy, Gen Z/TikTok-inspired language.",
      sassy: "Be bold and sassy.",
      detailed: "Be detailed and analytical.",
      parent: "Use a family-friendly, parent-oriented tone.",
      outdoorsy: "Use an outdoorsy, rugged tone."
    };
    const toneInstruction = toneOfVoice && toneOfVoice !== "default" ? toneInstructions[toneOfVoice] || "" : "";
    const prompt = `${toneInstruction ? toneInstruction + "\n" : ""}You are an AI assistant specializing in analyzing customer feedback for an e-commerce product.
Your task is to summarize the provided customer review snippets concisely and objectively. Aim for a summary of 2-3 sentences maximum.
Focus on extracting the core sentiment and recurring themes (both positive and negative).
DO NOT list individual reviews or quote directly unless illustrating a very specific, common point briefly.
Keep the summary brief and easy to read, suitable for display on a product page. Keep the summary concise and in simple language.
Start the summary directly, without introductory phrases like "Here is a summary...".

Customer Review Snippets:
---
${scrapedReviews}
---

Very Concise Summary (2-3 sentences):`;
    console.log("Calling OpenAI (NON-STREAMING TEST) with prompt:", prompt);
    const completion = await openai$2.chat.completions.create({
      model: "gpt-4o-mini",
      // Keep model consistent for now
      messages: [{
        role: "user",
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 150
    });
    console.log("OpenAI non-streaming call completed");
    const answer = ((_c = (_b = (_a2 = completion.choices[0]) == null ? void 0 : _a2.message) == null ? void 0 : _b.content) == null ? void 0 : _c.trim()) ?? "Sorry, I couldn't generate a summary (non-streaming test).";
    return json({ summary: answer });
  } catch (error) {
    console.error("RAW Error object in resource-review-summary route:", error);
    let errorMessage = "An error occurred generating the review summary.";
    if (error instanceof Error) {
      console.log("Error is an instance of Error. Message:", error.message);
      errorMessage = error.message;
    } else if (typeof error === "string") {
      console.log("Error is a string:", error);
      errorMessage = error;
    } else if (error && typeof error === "object") {
      console.log("Error is an object:", error);
      errorMessage = (error == null ? void 0 : error.message) ?? (error == null ? void 0 : error.error) ?? "";
      if (!errorMessage) {
        try {
          console.log("Attempting JSON.stringify on error object.");
          errorMessage = JSON.stringify(error);
        } catch (stringifyError) {
          console.error("Failed to stringify error object:", stringifyError);
          errorMessage = "An unknown error object was encountered.";
        }
      }
    } else {
      console.log("Error is of unknown type:", typeof error);
      errorMessage = "An unknown error type was encountered.";
    }
    console.error("Final Error message being sent to frontend:", errorMessage);
    const finalErrorMessageString = typeof errorMessage === "string" ? errorMessage : "Failed to determine error message.";
    return new Response(`Error: ${finalErrorMessageString}
`, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
async function loader$e() {
  console.log("RESOURCE-REVIEW-SUMMARY GET REQUEST!");
  return json({ status: "Review Summary API endpoint is operational (streaming v4)" });
}
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$9,
  loader: loader$e
}, Symbol.toStringTag, { value: "Module" }));
const action$8 = async ({ request }) => {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  const isValid = await verifyShopifyHmac(request.clone(), secret);
  if (!isValid) {
    console.error("Webhook HMAC verification failed for SHOP_REDACT");
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const payload = await request.json();
    console.log("Received SHOP_REDACT webhook:", payload);
  } catch (error) {
    console.error("Error processing SHOP_REDACT webhook:", error);
    return json({ success: false, error: "Failed to process webhook" }, { status: 200 });
  }
  return json({ success: true });
};
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$8
}, Symbol.toStringTag, { value: "Module" }));
const action$7 = async ({ request }) => {
  const secret = process.env.SHOPIFY_API_SECRET || "";
  const isValid = await verifyShopifyHmac(request.clone(), secret);
  if (!isValid) {
    console.error("Webhook HMAC verification failed for SHOP_UPDATE");
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const payload = await request.json();
    console.log("Received SHOP_UPDATE webhook:", payload);
  } catch (error) {
    console.error("Error processing SHOP_UPDATE webhook:", error);
    return json({ success: false, error: "Failed to process webhook" }, { status: 200 });
  }
  return json({ success: true });
};
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$7
}, Symbol.toStringTag, { value: "Module" }));
async function action$6({ request }) {
  console.log("RESOURCE-OPENAI ROUTE HIT (STREAMING v4 - Direct Provider)!");
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const { question, productContext } = await request.json();
    if (!question || !productContext) {
      return new Response("Missing question or product context", { status: 400 });
    }
    const MAX_QUESTION_LENGTH = 300;
    const MAX_CONTEXT_LENGTH = 5e3;
    if (question.length > MAX_QUESTION_LENGTH) {
      return new Response(`Question exceeds maximum length of ${MAX_QUESTION_LENGTH} characters.`, { status: 400 });
    }
    if (productContext.length > MAX_CONTEXT_LENGTH) {
      console.warn(`Product context truncated for OpenAI call. Original length: ${productContext.length}`);
      return new Response(`Product context exceeds maximum length of ${MAX_CONTEXT_LENGTH} characters.`, { status: 400 });
    }
    const prompt = `You are a product specialist for an online store. Your job is to answer customer questions with clarity, confidence, and a touch of marketing flair.
    You may make reasonable inferences based on the product details provided. Use context clues, related attributes, and common product knowledge to fill in gaps if necessary.
    When the user refers to "this" or "it" etc, assume they are referring to the product in the product context.
    If you're truly unsure, say: "I'm not certain based on the current product details."
    Be helpful, and friendly.

    When answering questions about reviews:
    *   DO NOT list individual reviews verbatim.
    *   Instead, SUMMARIZE the overall sentiment.
    *   Identify recurring themes, both positive (highlights) and negative (major criticisms).
    *   Mention the general consensus or any significant disagreements among reviewers.

    Product Information:
    ---
    ${productContext}
    ---

    User Question: ${question}

    Answer:`;
    const result = await streamText({
      // Call the imported openai function with just the model ID
      model: openai$3("gpt-4o-mini"),
      prompt,
      // Pass temperature and maxTokens directly to streamText
      temperature: 0.9,
      maxTokens: 180
    });
    return new Response(result.toDataStream(), {
      headers: { "Content-Type": "text/plain; charset=utf-8" }
      // Set appropriate content type
    });
  } catch (error) {
    console.error("Error in resource-openai route:", error);
    let errorMessage = "An error occurred processing your request.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return new Response(`Error: ${errorMessage}`, { status: 500 });
  }
}
async function loader$d() {
  console.log("RESOURCE-OPENAI GET REQUEST!");
  return json({ status: "OpenAI API endpoint is operational (streaming v4 - Direct Provider)" });
}
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$6,
  loader: loader$d
}, Symbol.toStringTag, { value: "Module" }));
const loader$c = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    return json({
      valid: true,
      shop: session.shop,
      scope: session.scope
    });
  } catch (error) {
    console.error("Session validation failed:", error);
    return json({
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 401 });
  }
};
const action$5 = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    return json({
      valid: true,
      shop: session.shop,
      scope: session.scope
    });
  } catch (error) {
    console.error("Session validation failed:", error);
    return json({
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 401 });
  }
};
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5,
  loader: loader$c
}, Symbol.toStringTag, { value: "Module" }));
const openai$1 = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});
async function getStoreInformation(shop) {
  try {
    const storeInfo = await prisma$1.storeInformation.findUnique({
      where: { shop }
    });
    return storeInfo;
  } catch (error) {
    console.log("Store information not available:", error);
    return null;
  }
}
function buildStoreContext(storeInfo) {
  if (!storeInfo) return "";
  const sections = [];
  if (storeInfo.storeName) sections.push(`Store Name: ${storeInfo.storeName}`);
  if (storeInfo.storeDescription) sections.push(`About Our Store: ${storeInfo.storeDescription}`);
  if (storeInfo.shippingPolicy) sections.push(`Shipping Policy: ${storeInfo.shippingPolicy}`);
  if (storeInfo.returnPolicy) sections.push(`Return Policy: ${storeInfo.returnPolicy}`);
  if (storeInfo.storeHours) sections.push(`Store Hours: ${storeInfo.storeHours}`);
  if (storeInfo.contactInfo) sections.push(`Contact Information: ${storeInfo.contactInfo}`);
  if (storeInfo.specialServices) sections.push(`Special Services: ${storeInfo.specialServices}`);
  if (storeInfo.aboutUs) sections.push(`About Us: ${storeInfo.aboutUs}`);
  if (storeInfo.additionalInfo) sections.push(`Additional Information: ${storeInfo.additionalInfo}`);
  return sections.length > 0 ? `

Store Information:
${sections.join("\n\n")}` : "";
}
async function action$4({ request }) {
  var _a2, _b, _c, _d, _e, _f;
  console.log("RESOURCE-OPENAI ROUTE HIT!");
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  try {
    const { operation, question, productContext, language, toneOfVoice, shop } = await request.json();
    const shopDomain = shop || request.headers.get("x-shop-domain") || "";
    const storeInfo = await getStoreInformation(shopDomain);
    const storeContext2 = buildStoreContext(storeInfo);
    if (!productContext) {
      return json({ error: "Missing product context" }, { status: 400 });
    }
    const MAX_CONTEXT_LENGTH = 5e3;
    if (productContext.length > MAX_CONTEXT_LENGTH) {
      console.warn(`Product context truncated for OpenAI call. Original length: ${productContext.length}`);
      return json({ error: `Product context exceeds maximum length of ${MAX_CONTEXT_LENGTH} characters.` }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return json({ error: "OpenAI API key not configured" }, { status: 500 });
    }
    const languageMap = {
      en: "English",
      fr: "French",
      de: "German",
      es: "Spanish",
      it: "Italian",
      zh: "Chinese",
      hi: "Hindi",
      ko: "Korean"
    };
    const languageName = languageMap[language] || "English";
    const toneInstructions = {
      professional: "Use a professional and neutral tone.",
      friendly: "Use a friendly and conversational tone.",
      playful: "Use a playful and witty tone.",
      minimalist: "Be extremely concise, like a TL;DR.",
      luxury: "Use a luxurious, high-end tone.",
      hype: "Use hype, trendy, Gen Z/TikTok-inspired language.",
      sassy: "Be bold and sassy.",
      detailed: "Be detailed and analytical.",
      parent: "Use a family-friendly, parent-oriented tone.",
      outdoorsy: "Use an outdoorsy, rugged tone."
    };
    const toneInstruction = toneOfVoice && toneOfVoice !== "default" ? toneInstructions[toneOfVoice] || "" : "";
    if (operation === "getSuggestedQuestions") {
      console.log("Operation: getSuggestedQuestions");
      const completion = await openai$1.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `Please analyze the following product information and generate exactly three distinct, relevant questions that a potential customer might ask about it. Consider both product-specific questions and general store policy questions based on the information provided. Respond only with a JSON array of strings, where each string is a question. Do not mention the name of the product - just refer to it as "this" or "it". Make sure that you are only asking questions that you're able to answer based on your knowledge. Keep the questions short and concise. Ensure the questions are in ${languageName}.

<product_information>
${productContext}
</product_information>${storeContext2}

Example JSON Output: ["Question 1?", "Question 2?", "Question 3?"]

Generated Questions:`
        }],
        temperature: 0.5,
        max_tokens: 200,
        response_format: { type: "json_object" }
        // Request JSON output if model supports it
      });
      const suggestionsContent = (_c = (_b = (_a2 = completion.choices[0]) == null ? void 0 : _a2.message) == null ? void 0 : _b.content) == null ? void 0 : _c.trim();
      if (!suggestionsContent) {
        console.error("OpenAI did not return content for suggested questions.");
        return json({ error: "Could not generate suggested questions" }, { status: 500 });
      }
      try {
        const suggestions = JSON.parse(suggestionsContent);
        return json({ suggestions });
      } catch (parseError) {
        console.error("Error parsing suggested questions response from OpenAI:", parseError, "Raw content:", suggestionsContent);
        const fallbackSuggestions = suggestionsContent.split("\n").map((s) => s.trim()).filter((s) => s.endsWith("?"));
        if (fallbackSuggestions.length > 0) {
          return json({ suggestions: fallbackSuggestions });
        } else {
          return json({ error: "Could not parse suggested questions from AI response" }, { status: 500 });
        }
      }
    } else {
      console.log("Operation: answerQuestion (default)");
      if (!question) {
        return json({ error: "Missing question field for this operation" }, { status: 400 });
      }
      const MAX_QUESTION_LENGTH = 300;
      if (question.length > MAX_QUESTION_LENGTH) {
        return json({ error: `Question exceeds maximum length of ${MAX_QUESTION_LENGTH} characters.` }, { status: 400 });
      }
      const completion = await openai$1.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `${toneInstruction ? toneInstruction + "\n" : ""}Please answer in ${languageName}.

You are a friendly and helpful product assistant for our online store.
Your goal is to answer the user's question accurately using the product and store information provided below. You are allowed to make assumptions based on the available information. If the question refers to "it" or "this", then assume the user is asking about the product.

<product_information>
${productContext}
</product_information>${storeContext2}

User Question: ${question}

If the answer is clearly stated in the product or store information, provide it concisely.
If the question is about shipping, returns, store policies, contact information, or general store details, use the store information provided.
If the answer cannot be found in the provided information OR you are unable to make an inference based on the available information, respond with: "I'm sorry, but I don't have the specific details to answer that based on the information available. Please contact us for more details."

Answer:`
        }],
        temperature: 0.3,
        max_tokens: 180
      });
      const answer = ((_f = (_e = (_d = completion.choices[0]) == null ? void 0 : _d.message) == null ? void 0 : _e.content) == null ? void 0 : _f.trim()) ?? "Sorry, I couldn't generate an answer.";
      return json({ answer });
    }
  } catch (error) {
    console.error("Error in resource-openai route:", error);
    return json({
      error: "An error occurred",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
async function loader$b() {
  console.log("RESOURCE-OPENAI GET REQUEST!");
  return json({ status: "OpenAI API endpoint is operational" });
}
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4,
  loader: loader$b
}, Symbol.toStringTag, { value: "Module" }));
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
async function action$3({ request }) {
  var _a2, _b, _c, _d, _e, _f;
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key not configured on the server.");
    return json({ error: "Server configuration error." }, { status: 500 });
  }
  let session;
  try {
    const authResult = await authenticate.admin(request);
    session = authResult.session;
  } catch (error) {
    console.error("Authentication failed:", error);
    return json({ error: "Authentication failed" }, { status: 401 });
  }
  let storeInfo;
  try {
    storeInfo = await prisma$1.storeInformation.findUnique({
      where: { shop: session.shop }
    });
  } catch (error) {
    console.error("Error fetching store information:", error);
    storeInfo = null;
  }
  let requestPayload;
  try {
    requestPayload = await request.json();
  } catch (e) {
    console.error("Failed to parse request JSON:", e);
    return json({ error: "Invalid request format." }, { status: 400 });
  }
  const { question, productContext, operation } = requestPayload;
  const buildStoreContext2 = () => {
    if (!storeInfo) return "";
    const storeContext22 = [];
    if (storeInfo.storeName) storeContext22.push(`Store Name: ${storeInfo.storeName}`);
    if (storeInfo.storeDescription) storeContext22.push(`Store Description: ${storeInfo.storeDescription}`);
    if (storeInfo.shippingPolicy) storeContext22.push(`Shipping Policy: ${storeInfo.shippingPolicy}`);
    if (storeInfo.returnPolicy) storeContext22.push(`Return Policy: ${storeInfo.returnPolicy}`);
    if (storeInfo.storeHours) storeContext22.push(`Store Hours: ${storeInfo.storeHours}`);
    if (storeInfo.contactInfo) storeContext22.push(`Contact Information: ${storeInfo.contactInfo}`);
    if (storeInfo.specialServices) storeContext22.push(`Special Services: ${storeInfo.specialServices}`);
    if (storeInfo.aboutUs) storeContext22.push(`About Us: ${storeInfo.aboutUs}`);
    if (storeInfo.additionalInfo) storeContext22.push(`Additional Information: ${storeInfo.additionalInfo}`);
    return storeContext22.length > 0 ? `

Store Information:
---
${storeContext22.join("\n")}
---
` : "";
  };
  const storeContext2 = buildStoreContext2();
  console.log("🏪 Store context being used:", storeContext2.length > 0 ? "Available" : "Empty");
  if (storeContext2.length > 0) {
    console.log("📋 Store context preview:", storeContext2.substring(0, 200) + "...");
  }
  if (operation === "getSuggestedQuestions") {
    if (!productContext) {
      return json({ error: "Missing product context for suggested questions" }, { status: 400 });
    }
    try {
      const prompt = `
        Generate exactly 3 distinct, concise questions that customers might ask about this product and store. Make the questions short, clickable, and relevant.

        IMPORTANT: Look at both the Product Information AND Store Information sections. Include questions about:
        - Product features, specifications, or details
        - Store policies (shipping, returns, warranties) if available
        - Services or support if mentioned

        Format: One question per line, no numbering, no quotes, no prefixes.

        Product Information:
        ---
        ${productContext}
        ---${storeContext2}

        Generate 3 relevant questions:
      `;
      console.log("Sending prompt to OpenAI for suggested questions...");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 100,
        n: 1
      });
      console.log("Received response from OpenAI for suggested questions.");
      const content2 = (_c = (_b = (_a2 = completion.choices[0]) == null ? void 0 : _a2.message) == null ? void 0 : _b.content) == null ? void 0 : _c.trim();
      if (!content2) {
        return json({ error: "Failed to generate suggested questions from AI." }, { status: 500 });
      }
      const suggestedQuestions = content2.split("\n").map((q) => q.trim()).filter((q) => q.length > 0).slice(0, 3);
      return json({ suggestedQuestions });
    } catch (error) {
      console.error("OpenAI API Call Error (Suggested Questions):", error);
      let errorMessage = "Failed to get suggested questions from AI";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return json({ error: "Failed to communicate with OpenAI for suggested questions", details: errorMessage }, { status: 500 });
    }
  } else {
    if (!question || !productContext) {
      return json({ error: "Missing question or product context" }, { status: 400 });
    }
    try {
      const prompt = `
        You are a helpful product specialist for an online store. Your primary goal is to provide accurate, helpful answers using the information provided below.

        IMPORTANT INSTRUCTIONS:
        - ALWAYS check the Store Information section for policies, shipping, returns, hours, contact details, etc.
        - If a customer asks about warranties, returns, shipping, policies, or store services, look in the Store Information section and provide specific details from there
        - For product-specific questions, use the Product Information section
        - If the information exists in either section, provide it directly and confidently
        - Only say you don't have information if it's truly not provided in either section
        - Be specific, helpful, and reference the actual policies/information provided
        - When referring to "this product" or "it", use the product context provided

        Product Information:
        ---
        ${productContext}
        ---${storeContext2}

        User Question: ${question}

        Answer (be specific and use the information provided above):
      `;
      console.log("Sending prompt to OpenAI for answer...");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        max_tokens: 180
      });
      console.log("Received response from OpenAI for answer.");
      const answer = ((_f = (_e = (_d = completion.choices[0]) == null ? void 0 : _d.message) == null ? void 0 : _e.content) == null ? void 0 : _f.trim()) ?? "Sorry, I couldn't generate an answer.";
      return json({ answer });
    } catch (error) {
      console.error("OpenAI API Call Error (Answer):", error);
      let errorMessage = "Failed to get answer from AI";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      return json({ error: "Failed to communicate with OpenAI for answer", details: errorMessage }, { status: 500 });
    }
  }
}
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3
}, Symbol.toStringTag, { value: "Module" }));
const Polaris = {
  ActionMenu: {
    Actions: {
      moreActions: "More actions"
    },
    RollupActions: {
      rollupButton: "View actions"
    }
  },
  ActionList: {
    SearchField: {
      clearButtonLabel: "Clear",
      search: "Search",
      placeholder: "Search actions"
    }
  },
  Avatar: {
    label: "Avatar",
    labelWithInitials: "Avatar with initials {initials}"
  },
  Autocomplete: {
    spinnerAccessibilityLabel: "Loading",
    ellipsis: "{content}…"
  },
  Badge: {
    PROGRESS_LABELS: {
      incomplete: "Incomplete",
      partiallyComplete: "Partially complete",
      complete: "Complete"
    },
    TONE_LABELS: {
      info: "Info",
      success: "Success",
      warning: "Warning",
      critical: "Critical",
      attention: "Attention",
      "new": "New",
      readOnly: "Read-only",
      enabled: "Enabled"
    },
    progressAndTone: "{toneLabel} {progressLabel}"
  },
  Banner: {
    dismissButton: "Dismiss notification"
  },
  Button: {
    spinnerAccessibilityLabel: "Loading"
  },
  Common: {
    checkbox: "checkbox",
    undo: "Undo",
    cancel: "Cancel",
    clear: "Clear",
    close: "Close",
    submit: "Submit",
    more: "More"
  },
  ContextualSaveBar: {
    save: "Save",
    discard: "Discard"
  },
  DataTable: {
    sortAccessibilityLabel: "sort {direction} by",
    navAccessibilityLabel: "Scroll table {direction} one column",
    totalsRowHeading: "Totals",
    totalRowHeading: "Total"
  },
  DatePicker: {
    previousMonth: "Show previous month, {previousMonthName} {showPreviousYear}",
    nextMonth: "Show next month, {nextMonth} {nextYear}",
    today: "Today ",
    start: "Start of range",
    end: "End of range",
    months: {
      january: "January",
      february: "February",
      march: "March",
      april: "April",
      may: "May",
      june: "June",
      july: "July",
      august: "August",
      september: "September",
      october: "October",
      november: "November",
      december: "December"
    },
    days: {
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      sunday: "Sunday"
    },
    daysAbbreviated: {
      monday: "Mo",
      tuesday: "Tu",
      wednesday: "We",
      thursday: "Th",
      friday: "Fr",
      saturday: "Sa",
      sunday: "Su"
    }
  },
  DiscardConfirmationModal: {
    title: "Discard all unsaved changes",
    message: "If you discard changes, you’ll delete any edits you made since you last saved.",
    primaryAction: "Discard changes",
    secondaryAction: "Continue editing"
  },
  DropZone: {
    single: {
      overlayTextFile: "Drop file to upload",
      overlayTextImage: "Drop image to upload",
      overlayTextVideo: "Drop video to upload",
      actionTitleFile: "Add file",
      actionTitleImage: "Add image",
      actionTitleVideo: "Add video",
      actionHintFile: "or drop file to upload",
      actionHintImage: "or drop image to upload",
      actionHintVideo: "or drop video to upload",
      labelFile: "Upload file",
      labelImage: "Upload image",
      labelVideo: "Upload video"
    },
    allowMultiple: {
      overlayTextFile: "Drop files to upload",
      overlayTextImage: "Drop images to upload",
      overlayTextVideo: "Drop videos to upload",
      actionTitleFile: "Add files",
      actionTitleImage: "Add images",
      actionTitleVideo: "Add videos",
      actionHintFile: "or drop files to upload",
      actionHintImage: "or drop images to upload",
      actionHintVideo: "or drop videos to upload",
      labelFile: "Upload files",
      labelImage: "Upload images",
      labelVideo: "Upload videos"
    },
    errorOverlayTextFile: "File type is not valid",
    errorOverlayTextImage: "Image type is not valid",
    errorOverlayTextVideo: "Video type is not valid"
  },
  EmptySearchResult: {
    altText: "Empty search results"
  },
  Frame: {
    skipToContent: "Skip to content",
    navigationLabel: "Navigation",
    Navigation: {
      closeMobileNavigationLabel: "Close navigation"
    }
  },
  FullscreenBar: {
    back: "Back",
    accessibilityLabel: "Exit fullscreen mode"
  },
  Filters: {
    moreFilters: "More filters",
    moreFiltersWithCount: "More filters ({count})",
    filter: "Filter {resourceName}",
    noFiltersApplied: "No filters applied",
    cancel: "Cancel",
    done: "Done",
    clearAllFilters: "Clear all filters",
    clear: "Clear",
    clearLabel: "Clear {filterName}",
    addFilter: "Add filter",
    clearFilters: "Clear all",
    searchInView: "in:{viewName}"
  },
  FilterPill: {
    clear: "Clear",
    unsavedChanges: "Unsaved changes - {label}"
  },
  IndexFilters: {
    searchFilterTooltip: "Search and filter",
    searchFilterTooltipWithShortcut: "Search and filter (F)",
    searchFilterAccessibilityLabel: "Search and filter results",
    sort: "Sort your results",
    addView: "Add a new view",
    newView: "Custom search",
    SortButton: {
      ariaLabel: "Sort the results",
      tooltip: "Sort",
      title: "Sort by",
      sorting: {
        asc: "Ascending",
        desc: "Descending",
        az: "A-Z",
        za: "Z-A"
      }
    },
    EditColumnsButton: {
      tooltip: "Edit columns",
      accessibilityLabel: "Customize table column order and visibility"
    },
    UpdateButtons: {
      cancel: "Cancel",
      update: "Update",
      save: "Save",
      saveAs: "Save as",
      modal: {
        title: "Save view as",
        label: "Name",
        sameName: "A view with this name already exists. Please choose a different name.",
        save: "Save",
        cancel: "Cancel"
      }
    }
  },
  IndexProvider: {
    defaultItemSingular: "Item",
    defaultItemPlural: "Items",
    allItemsSelected: "All {itemsLength}+ {resourceNamePlural} are selected",
    selected: "{selectedItemsCount} selected",
    a11yCheckboxDeselectAllSingle: "Deselect {resourceNameSingular}",
    a11yCheckboxSelectAllSingle: "Select {resourceNameSingular}",
    a11yCheckboxDeselectAllMultiple: "Deselect all {itemsLength} {resourceNamePlural}",
    a11yCheckboxSelectAllMultiple: "Select all {itemsLength} {resourceNamePlural}"
  },
  IndexTable: {
    emptySearchTitle: "No {resourceNamePlural} found",
    emptySearchDescription: "Try changing the filters or search term",
    onboardingBadgeText: "New",
    resourceLoadingAccessibilityLabel: "Loading {resourceNamePlural}…",
    selectAllLabel: "Select all {resourceNamePlural}",
    selected: "{selectedItemsCount} selected",
    undo: "Undo",
    selectAllItems: "Select all {itemsLength}+ {resourceNamePlural}",
    selectItem: "Select {resourceName}",
    selectButtonText: "Select",
    sortAccessibilityLabel: "sort {direction} by"
  },
  Loading: {
    label: "Page loading bar"
  },
  Modal: {
    iFrameTitle: "body markup",
    modalWarning: "These required properties are missing from Modal: {missingProps}"
  },
  Page: {
    Header: {
      rollupActionsLabel: "View actions for {title}",
      pageReadyAccessibilityLabel: "{title}. This page is ready"
    }
  },
  Pagination: {
    previous: "Previous",
    next: "Next",
    pagination: "Pagination"
  },
  ProgressBar: {
    negativeWarningMessage: "Values passed to the progress prop shouldn’t be negative. Resetting {progress} to 0.",
    exceedWarningMessage: "Values passed to the progress prop shouldn’t exceed 100. Setting {progress} to 100."
  },
  ResourceList: {
    sortingLabel: "Sort by",
    defaultItemSingular: "item",
    defaultItemPlural: "items",
    showing: "Showing {itemsCount} {resource}",
    showingTotalCount: "Showing {itemsCount} of {totalItemsCount} {resource}",
    loading: "Loading {resource}",
    selected: "{selectedItemsCount} selected",
    allItemsSelected: "All {itemsLength}+ {resourceNamePlural} in your store are selected",
    allFilteredItemsSelected: "All {itemsLength}+ {resourceNamePlural} in this filter are selected",
    selectAllItems: "Select all {itemsLength}+ {resourceNamePlural} in your store",
    selectAllFilteredItems: "Select all {itemsLength}+ {resourceNamePlural} in this filter",
    emptySearchResultTitle: "No {resourceNamePlural} found",
    emptySearchResultDescription: "Try changing the filters or search term",
    selectButtonText: "Select",
    a11yCheckboxDeselectAllSingle: "Deselect {resourceNameSingular}",
    a11yCheckboxSelectAllSingle: "Select {resourceNameSingular}",
    a11yCheckboxDeselectAllMultiple: "Deselect all {itemsLength} {resourceNamePlural}",
    a11yCheckboxSelectAllMultiple: "Select all {itemsLength} {resourceNamePlural}",
    Item: {
      actionsDropdownLabel: "Actions for {accessibilityLabel}",
      actionsDropdown: "Actions dropdown",
      viewItem: "View details for {itemName}"
    },
    BulkActions: {
      actionsActivatorLabel: "Actions",
      moreActionsActivatorLabel: "More actions"
    }
  },
  SkeletonPage: {
    loadingLabel: "Page loading"
  },
  Tabs: {
    newViewAccessibilityLabel: "Create new view",
    newViewTooltip: "Create view",
    toggleTabsLabel: "More views",
    Tab: {
      rename: "Rename view",
      duplicate: "Duplicate view",
      edit: "Edit view",
      editColumns: "Edit columns",
      "delete": "Delete view",
      copy: "Copy of {name}",
      deleteModal: {
        title: "Delete view?",
        description: "This can’t be undone. {viewName} view will no longer be available in your admin.",
        cancel: "Cancel",
        "delete": "Delete view"
      }
    },
    RenameModal: {
      title: "Rename view",
      label: "Name",
      cancel: "Cancel",
      create: "Save",
      errors: {
        sameName: "A view with this name already exists. Please choose a different name."
      }
    },
    DuplicateModal: {
      title: "Duplicate view",
      label: "Name",
      cancel: "Cancel",
      create: "Create view",
      errors: {
        sameName: "A view with this name already exists. Please choose a different name."
      }
    },
    CreateViewModal: {
      title: "Create new view",
      label: "Name",
      cancel: "Cancel",
      create: "Create view",
      errors: {
        sameName: "A view with this name already exists. Please choose a different name."
      }
    }
  },
  Tag: {
    ariaLabel: "Remove {children}"
  },
  TextField: {
    characterCount: "{count} characters",
    characterCountWithMaxLength: "{count} of {limit} characters used"
  },
  TooltipOverlay: {
    accessibilityLabel: "Tooltip: {label}"
  },
  TopBar: {
    toggleMenuLabel: "Toggle menu",
    SearchField: {
      clearButtonLabel: "Clear",
      search: "Search"
    }
  },
  MediaCard: {
    dismissButton: "Dismiss",
    popoverButton: "Actions"
  },
  VideoThumbnail: {
    playButtonA11yLabel: {
      "default": "Play video",
      defaultWithDuration: "Play video of length {duration}",
      duration: {
        hours: {
          other: {
            only: "{hourCount} hours",
            andMinutes: "{hourCount} hours and {minuteCount} minutes",
            andMinute: "{hourCount} hours and {minuteCount} minute",
            minutesAndSeconds: "{hourCount} hours, {minuteCount} minutes, and {secondCount} seconds",
            minutesAndSecond: "{hourCount} hours, {minuteCount} minutes, and {secondCount} second",
            minuteAndSeconds: "{hourCount} hours, {minuteCount} minute, and {secondCount} seconds",
            minuteAndSecond: "{hourCount} hours, {minuteCount} minute, and {secondCount} second",
            andSeconds: "{hourCount} hours and {secondCount} seconds",
            andSecond: "{hourCount} hours and {secondCount} second"
          },
          one: {
            only: "{hourCount} hour",
            andMinutes: "{hourCount} hour and {minuteCount} minutes",
            andMinute: "{hourCount} hour and {minuteCount} minute",
            minutesAndSeconds: "{hourCount} hour, {minuteCount} minutes, and {secondCount} seconds",
            minutesAndSecond: "{hourCount} hour, {minuteCount} minutes, and {secondCount} second",
            minuteAndSeconds: "{hourCount} hour, {minuteCount} minute, and {secondCount} seconds",
            minuteAndSecond: "{hourCount} hour, {minuteCount} minute, and {secondCount} second",
            andSeconds: "{hourCount} hour and {secondCount} seconds",
            andSecond: "{hourCount} hour and {secondCount} second"
          }
        },
        minutes: {
          other: {
            only: "{minuteCount} minutes",
            andSeconds: "{minuteCount} minutes and {secondCount} seconds",
            andSecond: "{minuteCount} minutes and {secondCount} second"
          },
          one: {
            only: "{minuteCount} minute",
            andSeconds: "{minuteCount} minute and {secondCount} seconds",
            andSecond: "{minuteCount} minute and {secondCount} second"
          }
        },
        seconds: {
          other: "{secondCount} seconds",
          one: "{secondCount} second"
        }
      }
    }
  }
};
const polarisTranslations = {
  Polaris
};
const polarisStyles = "/assets/styles-BeiPL2RV.css";
function loginErrorMessage(loginErrors) {
  if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  } else if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }
  return {};
}
const links$1 = () => [{ rel: "stylesheet", href: polarisStyles }];
const loader$a = async ({ request }) => {
  let errors = {};
  try {
    await authenticate.admin(request);
  } catch (e) {
    errors = loginErrorMessage(e);
  }
  return { errors, polarisTranslations };
};
const action$2 = async ({ request }) => {
  let errors = {};
  try {
    await authenticate.admin(request);
  } catch (e) {
    errors = loginErrorMessage(e);
  }
  return { errors };
};
function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;
  return /* @__PURE__ */ jsx(AppProvider, { i18n: loaderData.polarisTranslations, children: /* @__PURE__ */ jsx(Page, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx(Form, { method: "post", children: /* @__PURE__ */ jsxs(FormLayout, { children: [
    /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Log in" }),
    /* @__PURE__ */ jsx(
      TextField,
      {
        type: "text",
        name: "shop",
        label: "Shop domain",
        helpText: "example.myshopify.com",
        value: shop,
        onChange: setShop,
        autoComplete: "on",
        error: errors.shop
      }
    ),
    /* @__PURE__ */ jsx(Button, { submit: true, children: "Log in" })
  ] }) }) }) }) });
}
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2,
  default: Auth,
  links: links$1,
  loader: loader$a
}, Symbol.toStringTag, { value: "Module" }));
const loader$9 = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const state = url.searchParams.get("state");
  const customParam = url.searchParams.get("customParam");
  console.log("📝 Install route: Capturing custom parameters", {
    shop,
    state,
    customParam,
    url: request.url
  });
  if (!shop) {
    throw new Error("Shop parameter is required");
  }
  if (state || customParam) {
    console.log("📝 Install route: Custom installation detected", {
      shop,
      customData: { state, customParam }
    });
  }
  return redirect(`/app?shop=${shop}&embedded=1`);
};
const route13 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$9
}, Symbol.toStringTag, { value: "Module" }));
const index = "_index_12o3y_1";
const heading = "_heading_12o3y_11";
const text = "_text_12o3y_12";
const content = "_content_12o3y_22";
const form = "_form_12o3y_27";
const label = "_label_12o3y_35";
const input = "_input_12o3y_43";
const button = "_button_12o3y_47";
const list = "_list_12o3y_51";
const styles = {
  index,
  heading,
  text,
  content,
  form,
  label,
  input,
  button,
  list
};
const loader$8 = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: true };
};
function App$1() {
  const { showForm } = useLoaderData();
  return /* @__PURE__ */ jsx("div", { className: styles.index, children: /* @__PURE__ */ jsxs("div", { className: styles.content, children: [
    /* @__PURE__ */ jsx("h1", { className: styles.heading, children: "A short heading about [your app]" }),
    /* @__PURE__ */ jsx("p", { className: styles.text, children: "A tagline about [your app] that describes your value proposition." }),
    showForm && /* @__PURE__ */ jsxs(Form, { className: styles.form, method: "post", action: "/auth/login", children: [
      /* @__PURE__ */ jsxs("label", { className: styles.label, children: [
        /* @__PURE__ */ jsx("span", { children: "Shop domain" }),
        /* @__PURE__ */ jsx("input", { className: styles.input, type: "text", name: "shop" }),
        /* @__PURE__ */ jsx("span", { children: "e.g: my-shop-domain.myshopify.com" })
      ] }),
      /* @__PURE__ */ jsx("button", { className: styles.button, type: "submit", children: "Log in" })
    ] }),
    /* @__PURE__ */ jsxs("ul", { className: styles.list, children: [
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product feature" }),
        ". Some detail about your feature and its benefit to your customer."
      ] }),
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product feature" }),
        ". Some detail about your feature and its benefit to your customer."
      ] }),
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product feature" }),
        ". Some detail about your feature and its benefit to your customer."
      ] })
    ] })
  ] }) });
}
const route14 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: App$1,
  loader: loader$8
}, Symbol.toStringTag, { value: "Module" }));
const loader$7 = async ({ request }) => {
  var _a2, _b;
  console.log("📝 Auth route loader starting", { url: request.url });
  try {
    console.log("📝 Auth route: Attempting authenticate.admin");
    const result = await authenticate.admin(request);
    console.log("✅ Auth route: Authentication successful", {
      hasSession: !!(result == null ? void 0 : result.session),
      shop: (_a2 = result == null ? void 0 : result.session) == null ? void 0 : _a2.shop,
      hasAdmin: !!(result == null ? void 0 : result.admin)
    });
    if (result instanceof Response) {
      console.log("📝 Auth route: Returning redirect response");
      return result;
    }
    console.log("📝 Auth route: OAuth completed, session established");
    return json({ success: true, shop: (_b = result == null ? void 0 : result.session) == null ? void 0 : _b.shop });
  } catch (error) {
    console.error("❌ Auth route: Authentication error", {
      message: error.message,
      stack: error.stack,
      url: request.url,
      headers: Object.fromEntries([...request.headers.entries()].filter(([key]) => !["cookie", "authorization"].includes(key.toLowerCase())))
    });
    throw error;
  }
};
function headers$4() {
  console.log("📝 Auth route: headers function called");
  return {
    "Content-Security-Policy": "frame-ancestors 'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com",
    "X-Frame-Options": "SAMEORIGIN",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "X-Requested-With, Content-Type, Accept"
  };
}
const route15 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  headers: headers$4,
  loader: loader$7
}, Symbol.toStringTag, { value: "Module" }));
const loader$6 = async () => {
  return json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    env: process.env.NODE_ENV,
    appUrl: process.env.SHOPIFY_APP_URL || "Not set",
    services: {
      openai: process.env.OPENAI_API_KEY ? "configured" : "not configured",
      database: process.env.DATABASE_URL ? "configured" : "not configured"
    }
  });
};
function headers$3() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };
}
function Health() {
  return null;
}
const route16 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Health,
  headers: headers$3,
  loader: loader$6
}, Symbol.toStringTag, { value: "Module" }));
const loader$5 = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const isValidSession = !!(session.shop && session.accessToken && session.scope);
    return json({
      status: "ok",
      embedded: true,
      appBridgeReady: true,
      sessionValid: isValidSession,
      shop: session.shop,
      scope: session.scope,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
const headers$2 = ({ loaderData }) => {
  const shop = loaderData == null ? void 0 : loaderData.shop;
  let frameAncestors = "'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com";
  if (shop) {
    frameAncestors = `'self' https://${shop} https://admin.shopify.com`;
  }
  return {
    "Content-Security-Policy": `frame-ancestors ${frameAncestors}`,
    "X-Frame-Options": "SAMEORIGIN",
    "Cache-Control": "no-cache, no-store, must-revalidate"
  };
};
const route17 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  headers: headers$2,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
const loader$4 = async ({ request }) => {
  const headers2 = Object.fromEntries(request.headers);
  if (process.env.NODE_ENV === "production" && headers2["x-debug-key"] !== process.env.DEBUG_SECRET) {
    return json(
      { error: "Not authorized for debug info in production" },
      { status: 403 }
    );
  }
  let databaseStatus = "Unknown";
  let error = null;
  try {
    await prisma$1.$queryRaw`SELECT 1`;
    databaseStatus = "Connected";
  } catch (e) {
    databaseStatus = "Error";
    error = e.message;
  }
  const envInfo = {
    NODE_ENV: process.env.NODE_ENV,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
    SCOPES: process.env.SCOPES,
    API_KEY_SET: !!process.env.SHOPIFY_API_KEY,
    API_SECRET_SET: !!process.env.SHOPIFY_API_SECRET,
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DIRECT_URL_SET: !!process.env.DIRECT_URL
  };
  return json({
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    database: {
      status: databaseStatus,
      error
    },
    environment: envInfo,
    request: {
      method: request.method,
      url: request.url,
      headers: headers2
    },
    headers: {
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com"
    }
  });
};
function headers$1() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Cache-Control": "no-store"
  };
}
function Debug() {
  return null;
}
const route18 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Debug,
  headers: headers$1,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const links = () => [
  { rel: "stylesheet", href: polarisStyles },
  // Ensure App Bridge script is loaded from Shopify's CDN for embedded app compliance
  { rel: "preload", href: "https://cdn.shopify.com/shopifycloud/app-bridge/app-bridge.js", as: "script" }
];
const loader$3 = async ({ request }) => {
  try {
    console.log("📝 App route loader: Authentication attempt started", { url: request.url });
    const { session } = await authenticate.admin(request);
    console.log("✅ App route loader: Authentication successful", { shop: session.shop });
    const apiKey = process.env.SHOPIFY_API_KEY || "";
    console.log("📝 App route loader: API key available:", !!apiKey);
    return {
      apiKey,
      shop: session.shop
    };
  } catch (error) {
    console.error("❌ App route loader: Authentication error", error);
    throw error;
  }
};
function App() {
  const { apiKey } = useLoaderData();
  console.log("📝 App component: Rendering with API key:", !!apiKey);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      "script",
      {
        src: "https://cdn.shopify.com/shopifycloud/app-bridge/app-bridge.js",
        async: true
      }
    ),
    /* @__PURE__ */ jsxs(AppProvider$1, { isEmbeddedApp: true, apiKey, children: [
      /* @__PURE__ */ jsxs(NavMenu, { children: [
        /* @__PURE__ */ jsx(Link, { to: "/app", rel: "home", children: "Home" }),
        /* @__PURE__ */ jsx(Link, { to: "/app/additional", children: "Additional page" })
      ] }),
      /* @__PURE__ */ jsx(Outlet, {})
    ] })
  ] });
}
function ErrorBoundary() {
  console.error("❌ App route error boundary triggered");
  return boundary.error(useRouteError());
}
const headers = ({ loaderData }) => {
  const shop = loaderData == null ? void 0 : loaderData.shop;
  console.log("📝 App route headers function called for shop:", shop);
  let frameAncestors = "'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com";
  if (shop) {
    frameAncestors = `'self' https://${shop} https://admin.shopify.com`;
  }
  return {
    ...boundary.headers({ loaderData }),
    "Content-Security-Policy": `frame-ancestors ${frameAncestors}`,
    "X-Frame-Options": "SAMEORIGIN"
  };
};
const route19 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: App,
  headers,
  links,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
async function loader$2({ request }) {
  const { session } = await authenticate.admin(request);
  try {
    console.log("🔍 Loading store info for shop:", session.shop);
    const storeInfo = await prisma$1.storeInformation.findUnique({
      where: { shop: session.shop }
    });
    console.log("📊 Store info found:", storeInfo ? "Yes" : "No", storeInfo ? `(${Object.keys(storeInfo).length} fields)` : "");
    return json({ storeInfo });
  } catch (error) {
    console.error("❌ Error loading store information:", error);
    return json({ storeInfo: null, error: "Failed to load store information" });
  }
}
async function action$1({ request }) {
  const { session } = await authenticate.admin(request);
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  let requestData;
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
    console.log("📝 Data being saved:", { storeName, storeDescription: (storeDescription == null ? void 0 : storeDescription.length) || 0 });
    const storeInfo = await prisma$1.storeInformation.upsert({
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
        updatedAt: /* @__PURE__ */ new Date()
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
const route20 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
let storeContext = "Provide details about your store, products, and policies here.";
async function loader$1({}) {
  return json({ storeContext });
}
async function action({ request }) {
  const formData = await request.formData();
  const context = formData.get("context");
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  if (typeof context !== "string" || context.length > 5e3) {
    return json({ error: "Invalid or too long context." }, { status: 400 });
  }
  storeContext = context;
  console.log("Updated store context:", storeContext);
  return json({ success: true, storeContext });
}
function StoreContextAdminPage() {
  const loaderData = useLoaderData();
  const fetcher = useFetcher();
  const [formState, setFormState] = useState(loaderData.storeContext);
  const [isSaved, setIsSaved] = useState(false);
  const handleContextChange = useCallback((value) => {
    setFormState(value);
    setIsSaved(false);
  }, []);
  if (fetcher.state === "idle" && fetcher.data && "success" in fetcher.data && fetcher.data.success && !isSaved) {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3e3);
  }
  const isSubmitting = fetcher.state === "submitting";
  return /* @__PURE__ */ jsx(Page, { title: "Store Context for AI", children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx(fetcher.Form, { method: "post", children: /* @__PURE__ */ jsxs(FormLayout, { children: [
    /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Provide information about your store that the AI assistant can use to answer customer questions. Include details about your brand, unique selling points, return policy, shipping details, etc." }),
    /* @__PURE__ */ jsx(
      TextField,
      {
        label: "Store Context",
        name: "context",
        value: formState,
        onChange: handleContextChange,
        multiline: 10,
        autoComplete: "off",
        helpText: "Maximum 5000 characters.",
        error: fetcher.data && "error" in fetcher.data ? fetcher.data.error : void 0
      }
    ),
    /* @__PURE__ */ jsx(Button, { submit: true, loading: isSubmitting, variant: "primary", children: isSubmitting ? "Saving..." : isSaved ? "Saved!" : "Save Context" })
  ] }) }) }) }) }) });
}
const route21 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: StoreContextAdminPage,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
function AdditionalPage() {
  return /* @__PURE__ */ jsxs(Page, { children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "Additional page" }),
    /* @__PURE__ */ jsxs(Layout, { children: [
      /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
        /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
          "The app template comes with an additional page which demonstrates how to create multiple pages within app navigation using",
          " ",
          /* @__PURE__ */ jsx(
            Link$1,
            {
              url: "https://shopify.dev/docs/apps/tools/app-bridge",
              target: "_blank",
              removeUnderline: true,
              children: "App Bridge"
            }
          ),
          "."
        ] }),
        /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
          "To create your own page and have it show up in the app navigation, add a page inside ",
          /* @__PURE__ */ jsx(Code, { children: "app/routes" }),
          ", and a link to it in the ",
          /* @__PURE__ */ jsx(Code, { children: "<NavMenu>" }),
          " component found in ",
          /* @__PURE__ */ jsx(Code, { children: "app/routes/app.jsx" }),
          "."
        ] })
      ] }) }) }),
      /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Resources" }),
        /* @__PURE__ */ jsx(List, { children: /* @__PURE__ */ jsx(List.Item, { children: /* @__PURE__ */ jsx(
          Link$1,
          {
            url: "https://shopify.dev/docs/apps/design-guidelines/navigation#app-nav",
            target: "_blank",
            removeUnderline: true,
            children: "App nav best practices"
          }
        ) }) })
      ] }) }) })
    ] })
  ] });
}
function Code({ children }) {
  return /* @__PURE__ */ jsx(
    Box,
    {
      as: "span",
      padding: "025",
      paddingInlineStart: "100",
      paddingInlineEnd: "100",
      background: "bg-surface-active",
      borderWidth: "025",
      borderColor: "border",
      borderRadius: "100",
      children: /* @__PURE__ */ jsx("code", { children })
    }
  );
}
const route22 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: AdditionalPage
}, Symbol.toStringTag, { value: "Module" }));
const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  let storeInfo = null;
  try {
    storeInfo = await prisma$1.storeInformation.findUnique({
      where: { shop: session.shop }
    });
    console.log("📝 Loaded store info for shop:", session.shop, storeInfo ? "Found" : "Not found");
  } catch (error) {
    console.error("Error loading store information:", error);
  }
  return { storeInfo };
};
function Index() {
  var _a2, _b;
  const app = useAppBridge();
  const { storeInfo } = useLoaderData();
  const fetcher = useFetcher();
  const [selectedTab, setSelectedTab] = useState(0);
  const [formData, setFormData] = useState({
    storeName: (storeInfo == null ? void 0 : storeInfo.storeName) || "",
    storeDescription: (storeInfo == null ? void 0 : storeInfo.storeDescription) || "",
    shippingPolicy: (storeInfo == null ? void 0 : storeInfo.shippingPolicy) || "",
    returnPolicy: (storeInfo == null ? void 0 : storeInfo.returnPolicy) || "",
    storeHours: (storeInfo == null ? void 0 : storeInfo.storeHours) || "",
    contactInfo: (storeInfo == null ? void 0 : storeInfo.contactInfo) || "",
    specialServices: (storeInfo == null ? void 0 : storeInfo.specialServices) || "",
    aboutUs: (storeInfo == null ? void 0 : storeInfo.aboutUs) || "",
    additionalInfo: (storeInfo == null ? void 0 : storeInfo.additionalInfo) || ""
  });
  useEffect(() => {
    console.log("🟢 ShopAI app loaded, checking App Bridge...");
    if (app) {
      console.log("🟢 App Bridge initialized successfully");
      if (app.getSessionToken) {
        app.getSessionToken().then((token) => {
          console.log("🟢 Session token validated successfully");
        }).catch((error2) => {
          console.error("🔴 Session token validation failed", error2);
        });
      }
    } else {
      console.error("🔴 App Bridge not initialized");
    }
  }, [app]);
  useEffect(() => {
    if (storeInfo) {
      setFormData({
        storeName: storeInfo.storeName || "",
        storeDescription: storeInfo.storeDescription || "",
        shippingPolicy: storeInfo.shippingPolicy || "",
        returnPolicy: storeInfo.returnPolicy || "",
        storeHours: storeInfo.storeHours || "",
        contactInfo: storeInfo.contactInfo || "",
        specialServices: storeInfo.specialServices || "",
        aboutUs: storeInfo.aboutUs || "",
        additionalInfo: storeInfo.additionalInfo || ""
      });
    }
  }, [storeInfo]);
  useEffect(() => {
    var _a3, _b2;
    if (((_a3 = fetcher.data) == null ? void 0 : _a3.success) && ((_b2 = fetcher.data) == null ? void 0 : _b2.storeInfo)) {
      setFormData({
        storeName: fetcher.data.storeInfo.storeName || "",
        storeDescription: fetcher.data.storeInfo.storeDescription || "",
        shippingPolicy: fetcher.data.storeInfo.shippingPolicy || "",
        returnPolicy: fetcher.data.storeInfo.returnPolicy || "",
        storeHours: fetcher.data.storeInfo.storeHours || "",
        contactInfo: fetcher.data.storeInfo.contactInfo || "",
        specialServices: fetcher.data.storeInfo.specialServices || "",
        aboutUs: fetcher.data.storeInfo.aboutUs || "",
        additionalInfo: fetcher.data.storeInfo.additionalInfo || ""
      });
      console.log("📝 Form data updated after successful save");
    }
  }, [fetcher.data]);
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  const handleSaveStoreInfo = () => {
    fetcher.submit(formData, {
      method: "POST",
      action: "/app/store-information",
      encType: "application/json"
    });
  };
  const isLoading = fetcher.state === "submitting";
  const showSuccess = (_a2 = fetcher.data) == null ? void 0 : _a2.success;
  const error = (_b = fetcher.data) == null ? void 0 : _b.error;
  const tabs = [
    {
      id: "overview",
      content: "Overview"
    },
    {
      id: "store-info",
      content: "Store Information"
    }
  ];
  return /* @__PURE__ */ jsxs(Page, { children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "ShopAI" }),
    /* @__PURE__ */ jsx(BlockStack, { gap: "500", children: /* @__PURE__ */ jsxs(Tabs, { tabs, selected: selectedTab, onSelect: setSelectedTab, children: [
      selectedTab === 0 && /* @__PURE__ */ jsxs(Layout, { children: [
        /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "500", children: [
          /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Box, { paddingBlockEnd: "200", children: /* @__PURE__ */ jsxs(InlineStack, { gap: "200", align: "start", children: [
              /* @__PURE__ */ jsx(Text, { as: "h1", variant: "headingLg", children: "Welcome to ShopAI 🤖" }),
              /* @__PURE__ */ jsx(Badge, { tone: "success", children: "v1.6.0" })
            ] }) }),
            /* @__PURE__ */ jsx(Text, { variant: "bodyLg", as: "p", children: "AI-powered product assistance and review summarization for your Shopify store." })
          ] }),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
            /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "What ShopAI Does" }),
            /* @__PURE__ */ jsxs(List, { children: [
              /* @__PURE__ */ jsxs(List.Item, { children: [
                /* @__PURE__ */ jsx("strong", { children: "Product Q&A:" }),
                " Customers can ask questions about your products and get instant AI-powered answers"
              ] }),
              /* @__PURE__ */ jsxs(List.Item, { children: [
                /* @__PURE__ */ jsx("strong", { children: "Review Summarization:" }),
                " Automatically summarize product reviews to highlight key insights"
              ] }),
              /* @__PURE__ */ jsxs(List.Item, { children: [
                /* @__PURE__ */ jsx("strong", { children: "Smart Suggestions:" }),
                " Generate relevant questions customers might have about products"
              ] }),
              /* @__PURE__ */ jsxs(List.Item, { children: [
                /* @__PURE__ */ jsx("strong", { children: "Store Context:" }),
                " Use your store information to provide better customer service answers"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            Banner,
            {
              title: "💡 Enhance AI Responses",
              status: "info",
              children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", children: 'Add your store information in the "Store Information" tab to help the AI provide more accurate answers about shipping, returns, store policies, and more!' })
            }
          ),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
            /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "How to Use ShopAI" }),
            /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "ShopAI adds two powerful blocks to your theme editor:" }),
            /* @__PURE__ */ jsx(Box, { padding: "300", background: "bg-surface-secondary", borderRadius: "200", children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
              /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
                /* @__PURE__ */ jsx(Badge, { children: "Block" }),
                /* @__PURE__ */ jsx(Text, { variant: "bodyMd", fontWeight: "semibold", children: "Ask Me Anything" })
              ] }),
              /* @__PURE__ */ jsx(Text, { variant: "bodyMd", children: "Add this block to product pages so customers can ask questions and get AI-powered answers about your products and store." })
            ] }) }),
            /* @__PURE__ */ jsx(Box, { padding: "300", background: "bg-surface-secondary", borderRadius: "200", children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
              /* @__PURE__ */ jsxs(InlineStack, { gap: "200", children: [
                /* @__PURE__ */ jsx(Badge, { children: "Block" }),
                /* @__PURE__ */ jsx(Text, { variant: "bodyMd", fontWeight: "semibold", children: "Review Summarizer" })
              ] }),
              /* @__PURE__ */ jsx(Text, { variant: "bodyMd", children: "Automatically summarize product reviews to help customers quickly understand the key points." })
            ] }) })
          ] }),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
            /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Getting Started" }),
            /* @__PURE__ */ jsxs(List, { type: "number", children: [
              /* @__PURE__ */ jsxs(List.Item, { children: [
                /* @__PURE__ */ jsx("strong", { children: "Add Store Information:" }),
                ' Fill out the "Store Information" tab with your policies and details'
              ] }),
              /* @__PURE__ */ jsxs(List.Item, { children: [
                "Go to your theme editor: ",
                /* @__PURE__ */ jsx("strong", { children: "Online Store → Themes → Customize" })
              ] }),
              /* @__PURE__ */ jsx(List.Item, { children: "Navigate to a product page template" }),
              /* @__PURE__ */ jsxs(List.Item, { children: [
                "Click ",
                /* @__PURE__ */ jsx("strong", { children: '"Add block"' }),
                " and look for the ShopAI blocks"
              ] }),
              /* @__PURE__ */ jsx(List.Item, { children: 'Add either "Ask Me Anything" or "Review Summarizer" (or both!)' }),
              /* @__PURE__ */ jsx(List.Item, { children: "Save your theme and test it on your live store" })
            ] })
          ] })
        ] }) }) }),
        /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: /* @__PURE__ */ jsxs(BlockStack, { gap: "500", children: [
          /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Technical Details" }),
            /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
              /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
                /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", children: "AI Model" }),
                /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", fontWeight: "medium", children: "GPT-4o Mini" })
              ] }),
              /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
                /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", children: "Framework" }),
                /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", fontWeight: "medium", children: "Remix" })
              ] }),
              /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
                /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", children: "Database" }),
                /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", fontWeight: "medium", children: "PostgreSQL" })
              ] }),
              /* @__PURE__ */ jsxs(InlineStack, { align: "space-between", children: [
                /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", children: "Hosting" }),
                /* @__PURE__ */ jsx(Text, { as: "span", variant: "bodyMd", fontWeight: "medium", children: "Fly.io" })
              ] })
            ] })
          ] }) }),
          /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Privacy & Security" }),
            /* @__PURE__ */ jsxs(List, { children: [
              /* @__PURE__ */ jsx(List.Item, { children: "Only product information and store details are processed" }),
              /* @__PURE__ */ jsx(List.Item, { children: "No customer data or sensitive information is shared" }),
              /* @__PURE__ */ jsx(List.Item, { children: "All AI requests are processed securely" }),
              /* @__PURE__ */ jsx(List.Item, { children: "Data is used only for generating responses" })
            ] })
          ] }) }),
          /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Need Help?" }),
            /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", children: [
              "If you need assistance with ShopAI, check the",
              " ",
              /* @__PURE__ */ jsx(Link$1, { url: "https://shopify.dev/docs/apps", target: "_blank", removeUnderline: true, children: "Shopify App documentation" }),
              " ",
              "or contact support."
            ] })
          ] }) })
        ] }) })
      ] }),
      selectedTab === 1 && /* @__PURE__ */ jsxs(Layout, { children: [
        /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "500", children: [
          /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingLg", children: "Store Information" }),
            /* @__PURE__ */ jsx(Text, { variant: "bodyMd", as: "p", children: "Provide information about your store to help the AI give better, more accurate answers to your customers. This information will be used when customers ask questions about shipping, returns, store policies, and general store information." })
          ] }),
          showSuccess && /* @__PURE__ */ jsx(Banner, { title: "Store information saved successfully!", status: "success" }),
          error && /* @__PURE__ */ jsx(Banner, { title: "Error saving store information", status: "critical", children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", children: error }) }),
          /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Store Name",
                value: formData.storeName,
                onChange: (value) => handleInputChange("storeName", value),
                placeholder: "Your store name",
                helpText: "The name of your store"
              }
            ),
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Store Description",
                value: formData.storeDescription,
                onChange: (value) => handleInputChange("storeDescription", value),
                multiline: 3,
                placeholder: "Brief description of your store and what you sell",
                helpText: "A brief overview of your store and products"
              }
            ),
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Shipping Policy",
                value: formData.shippingPolicy,
                onChange: (value) => handleInputChange("shippingPolicy", value),
                multiline: 4,
                placeholder: "Shipping times, costs, regions served, etc.",
                helpText: "Information about shipping times, costs, and regions you serve"
              }
            ),
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Return Policy",
                value: formData.returnPolicy,
                onChange: (value) => handleInputChange("returnPolicy", value),
                multiline: 4,
                placeholder: "Return window, conditions, process, etc.",
                helpText: "Your return and refund policy details"
              }
            ),
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Store Hours",
                value: formData.storeHours,
                onChange: (value) => handleInputChange("storeHours", value),
                multiline: 2,
                placeholder: "Monday-Friday: 9AM-6PM, Saturday: 10AM-4PM, etc.",
                helpText: "Business hours and availability (if applicable)"
              }
            ),
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Contact Information",
                value: formData.contactInfo,
                onChange: (value) => handleInputChange("contactInfo", value),
                multiline: 3,
                placeholder: "Email, phone, address, etc.",
                helpText: "How customers can reach you for support"
              }
            ),
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Special Services",
                value: formData.specialServices,
                onChange: (value) => handleInputChange("specialServices", value),
                multiline: 3,
                placeholder: "Custom orders, installation, consulting, etc.",
                helpText: "Any special services you offer"
              }
            ),
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "About Us",
                value: formData.aboutUs,
                onChange: (value) => handleInputChange("aboutUs", value),
                multiline: 4,
                placeholder: "Your story, mission, values, etc.",
                helpText: "Information about your company background and values"
              }
            ),
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Additional Information",
                value: formData.additionalInfo,
                onChange: (value) => handleInputChange("additionalInfo", value),
                multiline: 4,
                placeholder: "Any other information that might help answer customer questions",
                helpText: "Any other relevant information for customer service"
              }
            ),
            /* @__PURE__ */ jsx(InlineStack, { gap: "300", children: /* @__PURE__ */ jsx(
              Button,
              {
                primary: true,
                loading: isLoading,
                onClick: handleSaveStoreInfo,
                children: "Save Store Information"
              }
            ) })
          ] })
        ] }) }) }),
        /* @__PURE__ */ jsxs(Layout.Section, { variant: "oneThird", children: [
          /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "How This Helps" }),
            /* @__PURE__ */ jsx(Text, { variant: "bodyMd", children: 'When customers use the "Ask Me Anything" feature, the AI will have access to this store information to provide more accurate and helpful answers about:' }),
            /* @__PURE__ */ jsxs(List, { children: [
              /* @__PURE__ */ jsx(List.Item, { children: "Shipping times and costs" }),
              /* @__PURE__ */ jsx(List.Item, { children: "Return and refund processes" }),
              /* @__PURE__ */ jsx(List.Item, { children: "Store policies and procedures" }),
              /* @__PURE__ */ jsx(List.Item, { children: "Special services you offer" }),
              /* @__PURE__ */ jsx(List.Item, { children: "Contact information for support" }),
              /* @__PURE__ */ jsx(List.Item, { children: "General store information" })
            ] })
          ] }) }),
          /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
            /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Tips for Better Results" }),
            /* @__PURE__ */ jsxs(List, { children: [
              /* @__PURE__ */ jsxs(List.Item, { children: [
                /* @__PURE__ */ jsx("strong", { children: "Be specific:" }),
                " Include exact shipping times, costs, and regions"
              ] }),
              /* @__PURE__ */ jsxs(List.Item, { children: [
                /* @__PURE__ */ jsx("strong", { children: "Keep it current:" }),
                " Update information when policies change"
              ] }),
              /* @__PURE__ */ jsxs(List.Item, { children: [
                /* @__PURE__ */ jsx("strong", { children: "Be comprehensive:" }),
                " Include common questions customers ask"
              ] }),
              /* @__PURE__ */ jsxs(List.Item, { children: [
                /* @__PURE__ */ jsx("strong", { children: "Use clear language:" }),
                " Write as if explaining to a customer"
              ] })
            ] })
          ] }) })
        ] })
      ] })
    ] }) })
  ] });
}
const route23 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Index,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-DawX8-0o.js", "imports": ["/assets/index-BALFTjq4.js", "/assets/components-C1LH-GfK.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/root-DeeInR7c.js", "imports": ["/assets/index-BALFTjq4.js", "/assets/components-C1LH-GfK.js"], "css": [] }, "routes/webhooks.customers.data_request": { "id": "routes/webhooks.customers.data_request", "parentId": "root", "path": "webhooks/customers/data_request", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.customers.data_request-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/webhooks.app.scopes_update": { "id": "routes/webhooks.app.scopes_update", "parentId": "root", "path": "webhooks/app/scopes_update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.scopes_update-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/webhooks.customers.redact": { "id": "routes/webhooks.customers.redact", "parentId": "root", "path": "webhooks/customers/redact", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.customers.redact-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/webhooks.app.uninstalled": { "id": "routes/webhooks.app.uninstalled", "parentId": "root", "path": "webhooks/app/uninstalled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.uninstalled-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/resource-review-summary": { "id": "routes/resource-review-summary", "parentId": "root", "path": "resource-review-summary", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/resource-review-summary-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/webhooks.shop.redact": { "id": "routes/webhooks.shop.redact", "parentId": "root", "path": "webhooks/shop/redact", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.shop.redact-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/webhooks.shop.update": { "id": "routes/webhooks.shop.update", "parentId": "root", "path": "webhooks/shop/update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.shop.update-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/api.resource-openai": { "id": "routes/api.resource-openai", "parentId": "root", "path": "api/resource-openai", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/api.resource-openai-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/session.validate": { "id": "routes/session.validate", "parentId": "root", "path": "session/validate", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/session.validate-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/resource-openai": { "id": "routes/resource-openai", "parentId": "root", "path": "resource-openai", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/resource-openai-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/ask-openai": { "id": "routes/ask-openai", "parentId": "root", "path": "ask-openai", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/ask-openai-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/route-Dp_dsW92.js", "imports": ["/assets/index-BALFTjq4.js", "/assets/styles-rR8H7uxH.js", "/assets/components-C1LH-GfK.js", "/assets/Page-TU3pVIZY.js", "/assets/FormLayout-D-WSDOKx.js", "/assets/context-D91eywMU.js", "/assets/context-CAHjJUFx.js"], "css": [] }, "routes/install": { "id": "routes/install", "parentId": "root", "path": "install", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/install-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/route-RbPyu6ie.js", "imports": ["/assets/index-BALFTjq4.js", "/assets/components-C1LH-GfK.js"], "css": ["/assets/route-TqOIn4DE.css"] }, "routes/auth.$": { "id": "routes/auth.$", "parentId": "root", "path": "auth/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/auth._-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/health": { "id": "routes/health", "parentId": "root", "path": "health", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/health-CSxRPO1x.js", "imports": [], "css": [] }, "routes/health.embedded": { "id": "routes/health.embedded", "parentId": "routes/health", "path": "embedded", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/health.embedded-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/debug": { "id": "routes/debug", "parentId": "root", "path": "debug", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/debug-CZRkyE7c.js", "imports": [], "css": [] }, "routes/app": { "id": "routes/app", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": true, "module": "/assets/app-C2IrmF68.js", "imports": ["/assets/index-BALFTjq4.js", "/assets/components-C1LH-GfK.js", "/assets/styles-rR8H7uxH.js", "/assets/context-D91eywMU.js", "/assets/context-CAHjJUFx.js"], "css": [] }, "routes/app.store-information": { "id": "routes/app.store-information", "parentId": "routes/app", "path": "store-information", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.store-information-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/app.store-context": { "id": "routes/app.store-context", "parentId": "routes/app", "path": "store-context", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.store-context-zlIBT3Vi.js", "imports": ["/assets/index-BALFTjq4.js", "/assets/components-C1LH-GfK.js", "/assets/Page-TU3pVIZY.js", "/assets/Layout-CJks-rej.js", "/assets/FormLayout-D-WSDOKx.js", "/assets/context-D91eywMU.js"], "css": [] }, "routes/app.additional": { "id": "routes/app.additional", "parentId": "routes/app", "path": "additional", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.additional-7EjYURPp.js", "imports": ["/assets/index-BALFTjq4.js", "/assets/Page-TU3pVIZY.js", "/assets/TitleBar-C3YKMIJa.js", "/assets/Layout-CJks-rej.js", "/assets/context-D91eywMU.js"], "css": [] }, "routes/app._index": { "id": "routes/app._index", "parentId": "routes/app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app._index-LuzxO3-x.js", "imports": ["/assets/index-BALFTjq4.js", "/assets/components-C1LH-GfK.js", "/assets/Page-TU3pVIZY.js", "/assets/TitleBar-C3YKMIJa.js", "/assets/context-D91eywMU.js", "/assets/context-CAHjJUFx.js", "/assets/FormLayout-D-WSDOKx.js", "/assets/Layout-CJks-rej.js"], "css": [] } }, "url": "/assets/manifest-05b59573.js", "version": "05b59573" };
const mode = "production";
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "v3_fetcherPersist": true, "v3_relativeSplatPath": true, "v3_throwAbortReason": true, "v3_routeConfig": true, "v3_singleFetch": false, "v3_lazyRouteDiscovery": true, "unstable_optimizeDeps": false };
const isSpaMode = false;
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/webhooks.customers.data_request": {
    id: "routes/webhooks.customers.data_request",
    parentId: "root",
    path: "webhooks/customers/data_request",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/webhooks.app.scopes_update": {
    id: "routes/webhooks.app.scopes_update",
    parentId: "root",
    path: "webhooks/app/scopes_update",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/webhooks.customers.redact": {
    id: "routes/webhooks.customers.redact",
    parentId: "root",
    path: "webhooks/customers/redact",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/webhooks.app.uninstalled": {
    id: "routes/webhooks.app.uninstalled",
    parentId: "root",
    path: "webhooks/app/uninstalled",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/resource-review-summary": {
    id: "routes/resource-review-summary",
    parentId: "root",
    path: "resource-review-summary",
    index: void 0,
    caseSensitive: void 0,
    module: route5
  },
  "routes/webhooks.shop.redact": {
    id: "routes/webhooks.shop.redact",
    parentId: "root",
    path: "webhooks/shop/redact",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/webhooks.shop.update": {
    id: "routes/webhooks.shop.update",
    parentId: "root",
    path: "webhooks/shop/update",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/api.resource-openai": {
    id: "routes/api.resource-openai",
    parentId: "root",
    path: "api/resource-openai",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/session.validate": {
    id: "routes/session.validate",
    parentId: "root",
    path: "session/validate",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/resource-openai": {
    id: "routes/resource-openai",
    parentId: "root",
    path: "resource-openai",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "routes/ask-openai": {
    id: "routes/ask-openai",
    parentId: "root",
    path: "ask-openai",
    index: void 0,
    caseSensitive: void 0,
    module: route11
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route12
  },
  "routes/install": {
    id: "routes/install",
    parentId: "root",
    path: "install",
    index: void 0,
    caseSensitive: void 0,
    module: route13
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route14
  },
  "routes/auth.$": {
    id: "routes/auth.$",
    parentId: "root",
    path: "auth/*",
    index: void 0,
    caseSensitive: void 0,
    module: route15
  },
  "routes/health": {
    id: "routes/health",
    parentId: "root",
    path: "health",
    index: void 0,
    caseSensitive: void 0,
    module: route16
  },
  "routes/health.embedded": {
    id: "routes/health.embedded",
    parentId: "routes/health",
    path: "embedded",
    index: void 0,
    caseSensitive: void 0,
    module: route17
  },
  "routes/debug": {
    id: "routes/debug",
    parentId: "root",
    path: "debug",
    index: void 0,
    caseSensitive: void 0,
    module: route18
  },
  "routes/app": {
    id: "routes/app",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route19
  },
  "routes/app.store-information": {
    id: "routes/app.store-information",
    parentId: "routes/app",
    path: "store-information",
    index: void 0,
    caseSensitive: void 0,
    module: route20
  },
  "routes/app.store-context": {
    id: "routes/app.store-context",
    parentId: "routes/app",
    path: "store-context",
    index: void 0,
    caseSensitive: void 0,
    module: route21
  },
  "routes/app.additional": {
    id: "routes/app.additional",
    parentId: "routes/app",
    path: "additional",
    index: void 0,
    caseSensitive: void 0,
    module: route22
  },
  "routes/app._index": {
    id: "routes/app._index",
    parentId: "routes/app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route23
  }
};
export {
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  mode,
  publicPath,
  routes
};
