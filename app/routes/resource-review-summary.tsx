// shop-ai/app/routes/resource-review-summary.tsx - Resource route for AI review summarization
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";
// Use the standard OpenAI client directly for testing
import OpenAI from "openai";
import { hasActiveSubscriptionViaAPI, getBillingStatus } from "../utils/billing-check.server";
import { checkReviewSummaryLimit, incrementReviewSummaryCount } from "../utils/plan-management.server";
import { prisma } from "../db.server";
import { authenticate } from "../shopify.server";

// No default export - this makes it a resource route!

// Helper function to generate content hash for cache invalidation
function generateReviewHash(scrapedReviews: string, reviewCount: number): string {
  const content = `${scrapedReviews}|${reviewCount}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

// Helper function to count reviews from scraped content
function countReviews(scrapedReviews: string): number {
  return scrapedReviews.split('\n').filter(line => line.trim()).length;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    console.error("Error: Method not allowed");
    return new Response("Error: Method not allowed\n", { status: 405, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Extract shop from URL query parameters (App Proxy sends it in URL)
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get('shop') || '';
  console.log("🏪 Shop domain:", shopDomain);

  // Parse request body
  let productId: string | undefined;
  let scrapedReviews: string | undefined;
  let toneOfVoice: string | undefined;
  try {
    const body = await request.json();
    console.log("Received request body:", body);
    productId = body.productId;
    scrapedReviews = body.scrapedReviews;
    toneOfVoice = body.toneOfVoice;
    console.log("Received productId:", productId);
    console.log("Received scrapedReviews:", scrapedReviews);
    console.log("Received toneOfVoice:", toneOfVoice);
  } catch (e) {
    console.error("Error parsing JSON body:", e);
    return new Response("Error: Invalid JSON body\n", { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  if (!scrapedReviews) {
    console.error("Missing scraped review content");
    return new Response("Error: Missing scraped review content\n", { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // ProductId is optional - if not provided, caching won't work but generation will still proceed
  if (!productId) {
    console.warn("⚠️ ProductId not provided - caching disabled for this request");
  }

  const MAX_REVIEW_TEXT_LENGTH = 12000; // Doubled to handle more review content
  if (scrapedReviews.length > MAX_REVIEW_TEXT_LENGTH) {
    console.error(`Review content exceeds maximum length: ${scrapedReviews.length}`);
    return new Response(`Error: Review content exceeds maximum length of ${MAX_REVIEW_TEXT_LENGTH} characters.\n`, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Count reviews and generate hash for cache invalidation
  const reviewCount = countReviews(scrapedReviews);
  const reviewHash = generateReviewHash(scrapedReviews, reviewCount);
  console.log(`📊 Review count: ${reviewCount}, Hash: ${reviewHash}`);

  // Check cache first (before billing/limit checks for performance) - only if productId is available
  if (productId) {
    try {
      const cachedSummary = await prisma.reviewSummaryCache.findUnique({
        where: {
          shop_productId: {
            shop: shopDomain,
            productId: productId
          }
        }
      });

      if (cachedSummary) {
        // Check if cache is fresh (< 30 days old)
        const cacheAge = Date.now() - cachedSummary.generatedAt.getTime();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const isFresh = cacheAge < thirtyDaysMs;

        // Check if content matches
        const contentMatches = cachedSummary.reviewHash === reviewHash;

        if (isFresh && contentMatches) {
          console.log(`✅ Cache HIT: Returning cached summary (age: ${Math.floor(cacheAge / (24 * 60 * 60 * 1000))} days)`);
          return json({ summary: cachedSummary.summary, cached: true });
        } else {
          console.log(`🔄 Cache STALE: isFresh=${isFresh}, contentMatches=${contentMatches}`);
        }
      } else {
        console.log("❌ Cache MISS: No cached summary found");
      }
    } catch (error) {
      console.error("Error checking cache:", error);
      // Continue with generation if cache check fails
    }
  } else {
    console.log("⏭️ Skipping cache check - no productId provided");
  }

  // Check billing status and limits
  const hasSubscription = await hasActiveSubscriptionViaAPI(shopDomain);

  if (!hasSubscription) {
    // Free tier: check usage limits
    console.log("🆓 Free tier user - checking usage limits");
    const limitCheck = await checkReviewSummaryLimit(shopDomain);

    if (!limitCheck.allowed) {
      console.warn(`🚫 Review summary limit reached for shop: ${shopDomain}`);
      return json({
        error: "Monthly limit of 10 review summaries reached. Upgrade to Pro Plan for unlimited summaries.",
        requiresUpgrade: true,
        usage: {
          remaining: limitCheck.remaining,
          limit: limitCheck.limit
        }
      }, { status: 429 }); // 429 Too Many Requests
    }
    console.log(`✅ Free tier within limits: ${limitCheck.remaining} remaining`);
  } else {
    console.log("💎 Pro user - unlimited summaries");
  }

  try {
    // Map toneOfVoice to prompt instruction
    const toneInstructions: Record<string, string> = {
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
    const toneInstruction = toneOfVoice && toneOfVoice !== 'default' ? (toneInstructions[toneOfVoice] || '') : '';

    const prompt = `${toneInstruction ? toneInstruction + "\n" : ""}You are an AI assistant specializing in analyzing customer feedback for an e-commerce product. Analyze thoroughly and think step-by-step.
Your task is to provide a comprehensive, well-reasoned summary of the provided customer review snippets. Use your full analytical capabilities to extract the core sentiment and recurring themes (both positive and negative).
DO NOT list individual reviews or quote directly unless illustrating a very specific, common point briefly.
Keep the summary brief and easy to read, suitable for display on a product page. Keep the summary concise and in simple language.
Start the summary directly, without introductory phrases like "Here is a summary...".

Customer Review Snippets:
---
${scrapedReviews}
---

Very Concise Summary (2-3 sentences):`;

    console.log("Calling OpenAI (NON-STREAMING TEST) with prompt:", prompt);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    // --- Use NON-STREAMING method like in resource-openai.tsx ---
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use real OpenAI model for review summaries (text-only, cost-effective)
      messages: [{
        role: "user",
        content: prompt
      }],
      max_completion_tokens: 300, // Optimized for speed
    }, {
      // GPT-5 specific: Add timeout for better error handling
      timeout: 15000, // 15 second timeout for faster response
    });
    // --- END NON-STREAMING TEST ---

    console.log("OpenAI non-streaming call completed");

    const answer = completion.choices[0]?.message?.content?.trim() ??
      "Sorry, I couldn't generate a summary (non-streaming test).";

    // Save/update cache in database (only if productId is available)
    if (productId) {
      try {
        await prisma.reviewSummaryCache.upsert({
          where: {
            shop_productId: {
              shop: shopDomain,
              productId: productId
            }
          },
          update: {
            summary: answer,
            reviewCount: reviewCount,
            reviewHash: reviewHash,
            generatedAt: new Date(),
            updatedAt: new Date()
          },
          create: {
            shop: shopDomain,
            productId: productId,
            summary: answer,
            reviewCount: reviewCount,
            reviewHash: reviewHash
          }
        });
        console.log("💾 Cache saved successfully");
      } catch (cacheError) {
        console.error("Error saving cache (non-critical):", cacheError);
        // Don't fail the request if cache save fails
      }
    } else {
      console.log("⏭️ Skipping cache save - no productId provided");
    }

    // Increment usage counter for FREE tier only
    if (!hasSubscription) {
      try {
        await incrementReviewSummaryCount(shopDomain);
        console.log("📈 Usage counter incremented for free tier");
      } catch (countError) {
        console.error("Error incrementing usage counter (non-critical):", countError);
        // Don't fail the request if counter increment fails
      }
    }

    // Return as JSON, not a stream
    return json({ summary: answer, cached: false });

  } catch (error) {
    // Keep the enhanced error logging for now
    console.error("RAW Error object in resource-review-summary route:", error); // Log the raw error

    let errorMessage = "An error occurred generating the review summary.";

    if (error instanceof Error) {
      console.log("Error is an instance of Error. Message:", error.message);
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      console.log("Error is a string:", error);
      errorMessage = error;
    } else if (error && typeof error === 'object') {
        console.log("Error is an object:", error);
        errorMessage = (error as any)?.message ?? (error as any)?.error ?? '';
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

    const finalErrorMessageString = typeof errorMessage === 'string' ? errorMessage : "Failed to determine error message.";

    return new Response(`Error: ${finalErrorMessageString}\n`, { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

export async function loader() {
  console.log("RESOURCE-REVIEW-SUMMARY GET REQUEST!");
  return json({ status: "Review Summary API endpoint is operational (streaming v4)" });
} 