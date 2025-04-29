// shop-ai/app/routes/resource-review-summary.tsx - Resource route for AI review summarization
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
// Use the standard OpenAI client directly for testing
import OpenAI from "openai";

// Initialize OpenAI client (same as resource-openai.tsx)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// No default export - this makes it a resource route!

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    console.error("Error: Method not allowed");
    return new Response("Error: Method not allowed\n", { status: 405, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  let scrapedReviews: string | undefined;
  try {
    const body = await request.json();
    console.log("Received request body:", body);
    scrapedReviews = body.scrapedReviews;
    console.log("Received scrapedReviews:", scrapedReviews);
  } catch (e) {
    console.error("Error parsing JSON body:", e);
    return new Response("Error: Invalid JSON body\n", { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  if (!scrapedReviews) {
    console.error("Missing scraped review content");
    return new Response("Error: Missing scraped review content\n", { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const MAX_REVIEW_TEXT_LENGTH = 6000;
  if (scrapedReviews.length > MAX_REVIEW_TEXT_LENGTH) {
    console.error(`Review content exceeds maximum length: ${scrapedReviews.length}`);
    return new Response(`Error: Review content exceeds maximum length of ${MAX_REVIEW_TEXT_LENGTH} characters.\n`, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  try {
    const prompt = `You are an AI assistant specializing in analyzing customer feedback for an e-commerce product.
Your task is to summarize the provided customer review snippets concisely and objectively. Aim for a summary of 2-3 sentences maximum.
Focus on extracting the core sentiment and recurring themes (both positive and negative).
DO NOT list individual reviews or quote directly unless illustrating a very specific, common point briefly.
Keep the summary brief and easy to read, suitable for display on a product page.
Start the summary directly, without introductory phrases like "Here is a summary...".

Customer Review Snippets:
---
${scrapedReviews}
---

Very Concise Summary (2-3 sentences):`;

    console.log("Calling OpenAI (NON-STREAMING TEST) with prompt:", prompt);

    // --- Use NON-STREAMING method like in resource-openai.tsx ---
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Keep model consistent for now
      messages: [{
        role: "user",
        content: prompt
      }],
      temperature: 0.7,
      max_tokens: 150,
    });
    // --- END NON-STREAMING TEST ---

    console.log("OpenAI non-streaming call completed");

    const answer = completion.choices[0]?.message?.content?.trim() ??
      "Sorry, I couldn't generate a summary (non-streaming test).";

    // Return as JSON, not a stream
    return json({ summary: answer });

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