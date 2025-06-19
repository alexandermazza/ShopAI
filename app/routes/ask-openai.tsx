import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import OpenAI from "openai";
import { authenticate } from "../shopify.server.js";
// @ts-ignore - db.server.js is a JavaScript file
import prisma from "../db.server.js";

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

  // Authenticate to get session
  let session;
  try {
    const authResult = await authenticate.admin(request);
    session = authResult.session;
  } catch (error) {
    console.error("Authentication failed:", error);
    return json({ error: "Authentication failed" }, { status: 401 });
  }

  // Fetch store information
  let storeInfo;
  try {
    storeInfo = await prisma.storeInformation.findUnique({
      where: { shop: session.shop }
    });
  } catch (error) {
    console.error("Error fetching store information:", error);
    // Continue without store info if there's an error
    storeInfo = null;
  }

  let requestPayload: any;
  try {
    requestPayload = await request.json();
  } catch (e) {
    console.error("Failed to parse request JSON:", e);
    return json({ error: "Invalid request format." }, { status: 400 });
  }

  const { question, productContext, operation } = requestPayload;

  // Build store context string if store information exists
  const buildStoreContext = () => {
    if (!storeInfo) return "";
    
    const storeContext = [];
    if (storeInfo.storeName) storeContext.push(`Store Name: ${storeInfo.storeName}`);
    if (storeInfo.storeDescription) storeContext.push(`Store Description: ${storeInfo.storeDescription}`);
    if (storeInfo.shippingPolicy) storeContext.push(`Shipping Policy: ${storeInfo.shippingPolicy}`);
    if (storeInfo.returnPolicy) storeContext.push(`Return Policy: ${storeInfo.returnPolicy}`);
    if (storeInfo.storeHours) storeContext.push(`Store Hours: ${storeInfo.storeHours}`);
    if (storeInfo.contactInfo) storeContext.push(`Contact Information: ${storeInfo.contactInfo}`);
    if (storeInfo.specialServices) storeContext.push(`Special Services: ${storeInfo.specialServices}`);
    if (storeInfo.aboutUs) storeContext.push(`About Us: ${storeInfo.aboutUs}`);
    if (storeInfo.additionalInfo) storeContext.push(`Additional Information: ${storeInfo.additionalInfo}`);
    
    return storeContext.length > 0 ? 
      `\n\nStore Information:\n---\n${storeContext.join('\n')}\n---\n` : "";
  };

  const storeContext = buildStoreContext();
  console.log("🏪 Store context being used:", storeContext.length > 0 ? "Available" : "Empty");
  console.log("🏪 Shop from session:", session.shop);
  console.log("🏪 Store info found:", storeInfo ? "Yes" : "No");
  if (storeContext.length > 0) {
    console.log("📋 Full store context:", storeContext);
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
        ---${storeContext}

        Generate 3 relevant questions:
      `;
      console.log("📤 Sending prompt to OpenAI for suggested questions with", prompt.length, "characters");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300, // Increased from 100
        n: 1,
      });
      console.log("📥 Received response from OpenAI for suggested questions:", completion.choices[0]?.message?.content);
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
        ---${storeContext}

        User Question: ${question}

        Answer (be specific and use the information provided above):
      `;
      console.log("📤 Sending prompt to OpenAI for answer with", prompt.length, "characters");
      console.log("🔍 Question asked:", question);
      console.log("📋 Product context length:", productContext?.length || 0);
      console.log("🏪 Store context length:", storeContext?.length || 0);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", 
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3, // Reduced for more consistent responses
        max_tokens: 500, // Increased from 180
      });
      console.log("📥 Received response from OpenAI for answer:", completion.choices[0]?.message?.content);
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