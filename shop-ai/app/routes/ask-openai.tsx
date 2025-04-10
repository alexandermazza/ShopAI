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
      You are a helpful assistant for an online store.
      You are allowed to infer, but you are not allowed to make up information.
      Answer the user's question based *only* on the following product information.
      If the answer cannot be found in the product information, say "I'm sorry, I don't have that information based on the product details."

      Product Information:
      ---
      ${productContext}
      ---

      User Question: ${question}

      Answer:
    `;

    console.log("Sending prompt to OpenAI..."); // Log before calling API

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Or consider gpt-4-turbo-preview for potentially better results
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7, // Adjust for creativity vs. factuality
      max_tokens: 150, // Limit response length
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