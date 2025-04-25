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
    const { question, productContext, language } = await request.json();
    
    if (!question || !productContext) {
      return json({ error: "Missing question or product context" }, { status: 400 });
    }

    // Add server-side validation for input lengths
    const MAX_QUESTION_LENGTH = 300;
    const MAX_CONTEXT_LENGTH = 5000; // Adjust as needed

    if (question.length > MAX_QUESTION_LENGTH) {
      return json({ error: `Question exceeds maximum length of ${MAX_QUESTION_LENGTH} characters.` }, { status: 400 });
    }

    if (productContext.length > MAX_CONTEXT_LENGTH) {
      console.warn(`Product context truncated for OpenAI call. Original length: ${productContext.length}`);
      // Optionally truncate context instead of erroring, though it might affect answer quality
      // productContext = productContext.substring(0, MAX_CONTEXT_LENGTH);
      // For safety, let's error out if context is unexpectedly huge
       return json({ error: `Product context exceeds maximum length of ${MAX_CONTEXT_LENGTH} characters.` }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    // Map language codes to language names
    const languageMap: Record<string, string> = {
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ 
        role: "user", 
        content: `Please answer in ${languageName}.

You are a friendly and helpful product assistant for our online store.
Your goal is to answer the user's question accurately using *only* the product information provided below. Do not make assumptions or use external knowledge.

<product_information>
${productContext}
</product_information>

User Question: ${question}

If the answer is clearly stated in the product information, provide it concisely.
If the answer cannot be found in the provided information, respond with: "I'm sorry, but I don't have the specific details to answer that based on the product information available."

Answer:`
      }],
      temperature: 0.3,
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