import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  // Basic check for API key configuration
  if (!process.env.OPENAI_API_KEY) {
     console.error("OpenAI API key not configured on the server.");
     return json({ error: "Server configuration error." }, { status: 500 });
  }

  let question: string | undefined;
  let productContext: string | undefined;

  try {
      const jsonData = await request.json();
      question = jsonData.question;
      productContext = jsonData.productContext;
  } catch (e) {
      console.error("Failed to parse request JSON:", e);
      return json({ error: "Invalid request format." }, { status: 400 });
  }


  if (!question || !productContext) {
    return json({ error: "Missing question or product context" }, { status: 400 });
  }


  try {
    // Construct the prompt for OpenAI
    const prompt = `
      You are a product specialist for an online store. Your job is to answer customer questions with clarity, confidence, and a touch of marketing flair.
      You may make reasonable inferences based on the product details provided. Use context clues, related attributes, and common product knowledge to fill in gaps if necessary.
      When the user refers to "this" or "it" etc, assume they are referring to the product in the product context.
      If you're truly unsure, say: "I'm not certain based on the current product details."
      Be concise, helpful, and friendly.

      Additionally, if the question pertains to user reviews, provide insights based on the review data available. Highlight key points such as average ratings, common praises, or criticisms, and any notable trends in the reviews.

      Product Information:
      ---
      ${productContext}
      ---

      User Question: ${question}

      Answer:
    `;

    console.log("Sending prompt to OpenAI..."); // Log before calling API

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // gpt-4o-mini is the cheapest model and is more than sufficient for this task
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9, // Adjust for creativity vs. factuality
      max_tokens: 180, // Limit response length
    });

    console.log("Received response from OpenAI."); // Log after successful API call

    const answer = completion.choices[0]?.message?.content?.trim() ?? "Sorry, I couldn't generate an answer.";

    return json({ answer });

  } catch (error: unknown) {
    console.error("OpenAI API Call Error:", error); // Log the specific error
    let errorMessage = "Failed to get answer from AI";
    if (error instanceof Error) {
       errorMessage = error.message;
    } else if (typeof error === 'string') {
       errorMessage = error;
    }
    // Consider more specific error handling based on OpenAI error types
    // e.g., check for authentication errors, rate limits, etc.
    return json({ error: "Failed to communicate with OpenAI", details: errorMessage }, { status: 500 });
  }
} 