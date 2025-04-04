// shop-ai/app/routes/resource-openai.tsx - Pure resource route file
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// No default export - this makes it a resource route!

// Action function to handle POST requests
export async function action({ request }: ActionFunctionArgs) {
  console.log("RESOURCE-OPENAI ROUTE HIT!");
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { question, productContext } = await request.json();
    
    if (!question || !productContext) {
      return json({ error: "Missing question or product context" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ 
        role: "user", 
        content: `
          You are a helpful assistant for an online store.
          Answer the user's question based *only* on the following product information.
          If the answer cannot be found in the product information, say "I'm sorry, I don't have that information based on the product details."
          
          Product Information:
          ---
          ${productContext}
          ---
          
          User Question: ${question}
          
          Answer:
        `
      }],
      temperature: 0.7,
      max_tokens: 150,
    });

    const answer = completion.choices[0]?.message?.content?.trim() ?? 
      "Sorry, I couldn't generate an answer.";
      
    return json({ answer });
  } catch (error) {
    console.error("Error in resource-openai route:", error);
    return json({ 
      error: "An error occurred", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}

// Loader function to handle GET requests (optional)
export async function loader() {
  console.log("RESOURCE-OPENAI GET REQUEST!");
  return json({ status: "OpenAI API endpoint is operational" });
} 