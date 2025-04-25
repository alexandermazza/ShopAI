// shop-ai/app/routes/api.resource-review-summary.tsx - Resource route for AI review summarization
import type { ActionFunctionArgs } from "@remix-run/node";
// Use global Response
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Action function to handle POST requests for review summarization
export async function action({ request }: ActionFunctionArgs) {
  console.log("RESOURCE-REVIEW-SUMMARY ROUTE HIT (STREAMING v4)!");

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { scrapedReviews } = await request.json();

    if (!scrapedReviews) {
       return new Response("Missing scraped review content", { status: 400 });
    }

    // Add server-side validation for input lengths
    const MAX_REVIEW_TEXT_LENGTH = 6000; // Adjust based on typical review volume and token limits

    if (scrapedReviews.length > MAX_REVIEW_TEXT_LENGTH) {
      console.warn(`Scraped review text truncated for OpenAI call. Original length: ${scrapedReviews.length}`);
      // Truncate instead of erroring? Or return error?
      // For now, let's return an error to signal the issue clearly.
      return new Response(`Review content exceeds maximum length of ${MAX_REVIEW_TEXT_LENGTH} characters.`, { status: 400 });
    }

    // API Key check is implicitly handled by the SDK

    const prompt = `You are an AI assistant specializing in analyzing customer feedback for an e-commerce product.
    Your task is to summarize the provided customer review snippets concisely and objectively.
    Focus on extracting the core sentiment and recurring themes (both positive and negative).
    DO NOT list individual reviews or quote directly unless illustrating a very specific, common point briefly.
    Keep the summary brief and easy to read, suitable for display on a product page.
    Start the summary directly, without introductory phrases like "Here is a summary...".

    Customer Review Snippets:
    ---
    ${scrapedReviews}
    ---

    Concise Summary:`;

    // Use streamText for the summarization task
    const result = await streamText({
      // Use the same model or choose one appropriate for summarization
      model: openai('gpt-4o-mini'), 
      prompt: prompt,
      // Adjust parameters for summarization if needed
      temperature: 0.7, // Slightly lower temperature for more factual summary
      maxTokens: 150, // Limit summary length
    });

    // Return a global Response object with the stream
    return new Response(result.toDataStream(), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error) {
    console.error("Error in resource-review-summary route:", error);
    let errorMessage = "An error occurred generating the review summary.";
    if (error instanceof Error) {
       errorMessage = error.message;
    }
     // Return a global Response object for errors
     return new Response(`Error: ${errorMessage}`, { status: 500 });
  }
}

// Optional: Loader function (can be removed if GET is not needed)
// If kept, use json from remix
// import { json } from "@remix-run/node"; 
export async function loader() {
  console.log("RESOURCE-REVIEW-SUMMARY GET REQUEST!");
  // return json({ status: "Review Summary API endpoint is operational" });
  return new Response("Review Summary API endpoint. Use POST to submit reviews.", { status: 200 });
} 