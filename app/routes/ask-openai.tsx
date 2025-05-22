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

  let requestPayload: any;
  try {
    requestPayload = await request.json();
  } catch (e) {
    console.error("Failed to parse request JSON:", e);
    return json({ error: "Invalid request format." }, { status: 400 });
  }

  const { question, productContext, operation } = requestPayload;

  if (operation === "getSuggestedQuestions") {
    if (!productContext) {
      return json({ error: "Missing product context for suggested questions" }, { status: 400 });
    }
    try {
      const prompt = `
        You are an AI assistant for an e-commerce store. Based on the product information below, generate exactly 3 distinct, concise questions that a new customer, unfamiliar with the product, might ask. These questions should be short and to the point, suitable for clickable suggestions. Each question should be on a new line. Do not add any numbering, prefixes like "Q:", or quotation marks around the questions.

        Product Information:
        ---
        ${productContext}
        ---

        Generated Questions:
      `;
      console.log("Sending prompt to OpenAI for suggested questions...");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 100, 
        n: 1,
      });
      console.log("Received response from OpenAI for suggested questions.");
      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        return json({ error: "Failed to generate suggested questions from AI." }, { status: 500 });
      }
      const suggestedQuestions = content.split('\n').map(q => q.trim()).filter(q => q.length > 0).slice(0, 3);
      
      return json({ suggestedQuestions });

    } catch (error: unknown) {
      console.error("OpenAI API Call Error (Suggested Questions):", error);
      let errorMessage = "Failed to get suggested questions from AI";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      return json({ error: "Failed to communicate with OpenAI for suggested questions", details: errorMessage }, { status: 500 });
    }
  } else {
    // Existing logic for answering a question
    if (!question || !productContext) {
      return json({ error: "Missing question or product context" }, { status: 400 });
    }

    try {
      const prompt = `
        You are a product specialist for an online store. Your job is to answer customer questions with clarity, confidence, and a touch of marketing flair.
        You may make reasonable inferences based on the product details provided. Use context clues, related attributes, and common product knowledge to fill in gaps if necessary.
        When the user refers to "this" or "it" etc, assume they are referring to the product in the product context.
        If you\'re truly unsure, say: "I\'m not certain based on the current product details."
        Be concise, helpful, and friendly.

        Additionally, if the question pertains to user reviews, provide insights based on the review data available. Highlight key points such as average ratings, common praises, or criticisms, and any notable trends in the reviews.

        Product Information:
        ---
        ${productContext}
        ---

        User Question: ${question}

        Answer:
      `;
      console.log("Sending prompt to OpenAI for answer...");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", 
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9, 
        max_tokens: 180, 
      });
      console.log("Received response from OpenAI for answer.");
      const answer = completion.choices[0]?.message?.content?.trim() ?? "Sorry, I couldn\'t generate an answer.";
      return json({ answer });

    } catch (error: unknown) {
      console.error("OpenAI API Call Error (Answer):", error);
      let errorMessage = "Failed to get answer from AI";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      return json({ error: "Failed to communicate with OpenAI for answer", details: errorMessage }, { status: 500 });
    }
  }
} 