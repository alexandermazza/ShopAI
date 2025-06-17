// shop-ai/app/routes/resource-openai.tsx - Pure resource route file
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import OpenAI from "openai";
import prisma from "../db.server";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// Helper function to get store information
async function getStoreInformation(shop: string) {
  try {
    const storeInfo = await prisma.storeInformation.findUnique({
      where: { shop }
    });
    return storeInfo;
  } catch (error) {
    console.log("Store information not available:", error);
    return null;
  }
}

// Helper function to build store context string
function buildStoreContext(storeInfo: any) {
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
  
  return sections.length > 0 ? `\n\nStore Information:\n${sections.join('\n\n')}` : "";
}

// No default export - this makes it a resource route!

// Action function to handle POST requests
export async function action({ request }: ActionFunctionArgs) {
  console.log("RESOURCE-OPENAI ROUTE HIT!");
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Read the potential fields first
    const { operation, question, productContext, language, toneOfVoice, shop } = await request.json();

    // Get store information - use shop from request or extract from headers
    const shopDomain = shop || request.headers.get('x-shop-domain') || '';
    const storeInfo = await getStoreInformation(shopDomain);
    const storeContext = buildStoreContext(storeInfo);

    // --- VALIDATION ---
    if (!productContext) {
        return json({ error: "Missing product context" }, { status: 400 });
    }
    
    const MAX_CONTEXT_LENGTH = 5000; // Adjust as needed
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
    
    // --- LANGUAGE & TONE PREP ---
    const languageMap: Record<string, string> = {
      en: "English", fr: "French", de: "German", es: "Spanish", it: "Italian", zh: "Chinese", hi: "Hindi", ko: "Korean"
    };
    const languageName = languageMap[language] || "English";

    const toneInstructions: Record<string, string> = {
      professional: "Use a professional and neutral tone.", friendly: "Use a friendly and conversational tone.", playful: "Use a playful and witty tone.", minimalist: "Be extremely concise, like a TL;DR.", luxury: "Use a luxurious, high-end tone.", hype: "Use hype, trendy, Gen Z/TikTok-inspired language.", sassy: "Be bold and sassy.", detailed: "Be detailed and analytical.", parent: "Use a family-friendly, parent-oriented tone.", outdoorsy: "Use an outdoorsy, rugged tone."
    };
    const toneInstruction = toneOfVoice && toneOfVoice !== 'default' ? (toneInstructions[toneOfVoice] || '') : '';


    // --- OPERATION HANDLING ---

    if (operation === 'getSuggestedQuestions') {
      // --- GENERATE SUGGESTED QUESTIONS ---
      console.log("Operation: getSuggestedQuestions");
      
      // Note: No 'question' field needed for this operation
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", 
        messages: [{ 
          role: "user", 
          content: `Please analyze the following product information and generate exactly three distinct, relevant questions that a potential customer might ask about it. Consider both product-specific questions and general store policy questions based on the information provided. Respond only with a JSON array of strings, where each string is a question. Do not mention the name of the product - just refer to it as "this" or "it". Make sure that you are only asking questions that you're able to answer based on your knowledge. Keep the questions short and concise. Ensure the questions are in ${languageName}.

<product_information>
${productContext}
</product_information>${storeContext}

Example JSON Output: ["Question 1?", "Question 2?", "Question 3?"]

Generated Questions:`
        }],
        temperature: 0.5, 
        max_tokens: 200, 
        response_format: { type: "json_object" } // Request JSON output if model supports it
      });

      const suggestionsContent = completion.choices[0]?.message?.content?.trim();
      
      if (!suggestionsContent) {
        console.error("OpenAI did not return content for suggested questions.");
        return json({ error: "Could not generate suggested questions" }, { status: 500 });
      }

      try {
        // Attempt to parse the response as JSON
        // The model might not always return perfect JSON, so wrap in try/catch
        // A more robust approach might involve regex extraction if JSON parsing fails often
        const suggestions = JSON.parse(suggestionsContent); 
        // TODO: Validate if 'suggestions' is actually an array of strings
        return json({ suggestions }); 
      } catch (parseError) {
        console.error("Error parsing suggested questions response from OpenAI:", parseError, "Raw content:", suggestionsContent);
        // Fallback: Try to extract questions using a simple split if parsing fails
        const fallbackSuggestions = suggestionsContent.split('\n').map(s => s.trim()).filter(s => s.endsWith('?')); // Basic fallback
         if (fallbackSuggestions.length > 0) {
            return json({ suggestions: fallbackSuggestions });
         } else {
            return json({ error: "Could not parse suggested questions from AI response" }, { status: 500 });
         }
      }

    } else {
      // --- ANSWER QUESTION (DEFAULT OPERATION) ---
      console.log("Operation: answerQuestion (default)");
      
      // Validate required 'question' field for this operation
      if (!question) {
          return json({ error: "Missing question field for this operation" }, { status: 400 });
      }
      const MAX_QUESTION_LENGTH = 300;
      if (question.length > MAX_QUESTION_LENGTH) {
          return json({ error: `Question exceeds maximum length of ${MAX_QUESTION_LENGTH} characters.` }, { status: 400 });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ 
          role: "user", 
          content: `${toneInstruction ? toneInstruction + "\n" : ""}Please answer in ${languageName}.

You are a friendly and helpful product assistant for our online store.
Your goal is to answer the user's question accurately using the product and store information provided below. You are allowed to make assumptions based on the available information. If the question refers to "it" or "this", then assume the user is asking about the product.

<product_information>
${productContext}
</product_information>${storeContext}

User Question: ${question}

If the answer is clearly stated in the product or store information, provide it concisely.
If the question is about shipping, returns, store policies, contact information, or general store details, use the store information provided.
If the answer cannot be found in the provided information OR you are unable to make an inference based on the available information, respond with: "I'm sorry, but I don't have the specific details to answer that based on the information available. Please contact us for more details."

Answer:`
        }],
        temperature: 0.3,
        max_tokens: 180,
      });

      const answer = completion.choices[0]?.message?.content?.trim() ?? 
        "Sorry, I couldn't generate an answer.";
        
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

// Loader function to handle GET requests (optional)
export async function loader() {
  console.log("RESOURCE-OPENAI GET REQUEST!");
  return json({ status: "OpenAI API endpoint is operational" });
} 