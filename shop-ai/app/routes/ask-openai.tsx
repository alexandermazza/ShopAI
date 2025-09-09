import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import OpenAI from "openai";
import { authenticate } from "../../../app/shopify.server";
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

  const { question, productContext, operation, productImages } = requestPayload;

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

  // Helper function to determine if question needs vision analysis
  const requiresVision = (question: string) => {
    const visionKeywords = [
      'color', 'size', 'dimension', 'look', 'appear', 'see', 'show', 'visual',
      'nutritional', 'nutrition', 'ingredient', 'label', 'package', 'packaging',
      'measurement', 'weight', 'height', 'width', 'length', 'calories',
      'specification', 'spec', 'instruction', 'warning', 'image', 'picture',
      'care', 'wash', 'clean', 'material', 'fabric', 'texture'
    ];
    
    const questionLower = question.toLowerCase();
    return visionKeywords.some(keyword => questionLower.includes(keyword));
  };

  // Helper function to build messages with optional images
  const buildMessagesWithImages = (textContent: string, imageUrls: string[] = []) => {
    const content: any[] = [{ type: "text", text: textContent }];
    
    // Limit to 5 images
    const maxImages = 5;
    imageUrls.slice(0, maxImages).forEach(imageUrl => {
      content.push({
        type: "image_url",
        image_url: {
          url: imageUrl,
          detail: "high" // Always use high detail for consistent quality
        }
      });
    });

    return [{ role: "user" as const, content }];
  };

  const extractAssistantTextFromCompletion = (completion: any): string => {
    try {
      const message = completion?.choices?.[0]?.message;
      const content = message?.content;
      if (typeof content === 'string') return content.trim();
      if (Array.isArray(content)) {
        return content
          .map((part: any) => (typeof part === 'string' ? part : (part?.text ?? '')))
          .join(' ')
          .trim();
      }
    } catch {}
    return '';
  };

  const storeContext = buildStoreContext();
  const imageUrls = Array.isArray(productImages) ? productImages.slice(0, 5) : [];
  console.log("📸 Product images received:", imageUrls.length);
  
  // Validate image URLs (basic check for valid URLs)
  const validImageUrls = imageUrls.filter(url => {
    try {
      new URL(url);
      return url.startsWith('http') || url.startsWith('https');
    } catch {
      console.warn("📸 Invalid image URL detected and filtered:", url);
      return false;
    }
  });
  
  if (validImageUrls.length !== imageUrls.length) {
    console.log("📸 Filtered to", validImageUrls.length, "valid image URLs");
  }
  
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
      const hasImages = validImageUrls.length > 0;
      // For suggested questions, be more conservative with vision - only use if product likely has visual specs
      const hasVisualContext = productContext.toLowerCase().includes('nutrition') || 
                               productContext.toLowerCase().includes('ingredient') ||
                               productContext.toLowerCase().includes('specification') ||
                               productContext.toLowerCase().includes('dimension');
      const useVisionForSuggestions = hasImages && hasVisualContext;
      
      const imageAnalysisNote = validImageUrls.length > 0 ? 
        `\n\nIMPORTANT: I have also provided ${validImageUrls.length} product image(s) for analysis. Please examine these images for details like nutritional information, specifications, ingredients, care instructions, or other details that might not be mentioned in the text description. Include questions about information visible in the images.` : '';
      
      const prompt = `
        Generate 3 short, casual questions customers would naturally ask about this product. Keep them simple and conversational.

        IMPORTANT: Look at both the Product Information AND Store Information sections. Include questions about:
        - Product features, specifications, or details
        - Store policies (shipping, returns, warranties) if available

        Product info: ${productContext}${storeContext}

        Format: Just the questions, one per line. NO numbers, NO quotes, NO prefixes.

        Examples:
        How does this fit?
        What's the return policy?
        Is this waterproof?

        3 simple questions:
      `;
      console.log("📤 Sending prompt to OpenAI for suggested questions with", prompt.length, "characters");
      console.log("📸 Using vision for suggestions:", useVisionForSuggestions, "| Including", useVisionForSuggestions ? validImageUrls.length : 0, "images");
      
      const messages = buildMessagesWithImages(prompt, validImageUrls); // GPT-5 Nano efficiently handles images
      
      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini-2025-08-07", // GPT-5 Mini handles both text and vision efficiently
        messages: messages,
        // temperature: 1, // GPT-5 Nano only supports default temperature of 1
        max_completion_tokens: 100, // Keep questions short and punchy
        n: 1,
      });
      const content = extractAssistantTextFromCompletion(completion);
      console.log("📥 Received response from OpenAI for suggested questions:", content);
      if (!content) {
        return json({ error: "Failed to generate suggested questions from AI." }, { status: 500 });
      }
      const suggestedQuestions = content.split('\n').map(q => q.trim()).filter(q => q.length > 0).slice(0, 3);
      
      return json({ suggestions: { questions: suggestedQuestions } });

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
      const needsVision = requiresVision(question);
      const hasImages = validImageUrls.length > 0;
      const useVision = hasImages && needsVision;
      
      console.log("🔍 VISION DEBUG - Question:", question);
      console.log("🔍 VISION DEBUG - needsVision:", needsVision);
      console.log("🔍 VISION DEBUG - hasImages:", hasImages);
      console.log("🔍 VISION DEBUG - useVision:", useVision);
      console.log("🔍 VISION DEBUG - validImageUrls:", validImageUrls);
      
      const imageAnalysisNote = useVision ? 
        `\n\nIMAGE ANALYSIS INSTRUCTIONS: I have provided ${validImageUrls.length} product image(s) that you MUST analyze carefully. These images contain important product information that you should read and use to answer questions.

        CRITICAL: If you can see nutritional facts, ingredients, specifications, or any other information in the images, you MUST read and provide that information directly. Do NOT say you don't have information if it's visible in the images.

        Look for and read:
        - Nutrition Facts labels (calories, nutrients, serving sizes)
        - Ingredient lists and dietary information
        - Product dimensions, weights, and measurements
        - Care instructions, usage guidelines, or warnings
        - Technical specifications, model numbers, or certifications
        - Any text, labels, or annotations visible on packaging
        - Brand information and product details

        IMPORTANT: If the user asks about something that is clearly visible in the images (like calories on a nutrition label), provide the specific information you can see rather than giving a generic response about not having the information.` : '';

      const prompt = `
        You are a helpful product specialist for an online store. Your primary goal is to provide accurate, helpful answers using the information provided below.

        IMPORTANT INSTRUCTIONS:
        - ALWAYS check the Store Information section for policies, shipping, returns, hours, contact details, etc.
        - If a customer asks about warranties, returns, shipping, policies, or store services, look in the Store Information section and provide specific details from there
        - For product-specific questions, use the Product Information section
        - If the information exists in either section, provide it directly and confidently
        - Only say you don't have information if it's truly not provided in either section
        - Be specific, helpful, and reference the actual policies/information provided
        - When referring to "this product" or "it", use the product context provided${imageAnalysisNote}

        Product Information:
        ---
        ${productContext}
        ---${storeContext}

        User Question: ${question}

        Answer (be specific and use the information provided above):
      `;
      console.log("📤 Sending prompt to OpenAI for answer with", prompt.length, "characters");
      console.log("🔍 Question asked:", question);
      console.log("🧠 Vision needed:", needsVision, "| Has images:", hasImages, "| Using vision:", useVision);
      console.log("📝 Question for vision analysis:", question);
      console.log("🤖 Selected model: gpt-5-mini (multimodal, cost-effective)");
      console.log("📋 Product context length:", productContext?.length || 0);
      console.log("🏪 Store context length:", storeContext?.length || 0);
      console.log("📸 Including", useVision ? validImageUrls.length : 0, "images for analysis");
      
      // Always use high detail for consistent quality when using vision
      
      const messages = buildMessagesWithImages(prompt, validImageUrls); // GPT-5 Nano efficiently handles images
      
      const selectedModel = "gpt-5-mini-2025-08-07"; // GPT-5 Mini is multimodal and cost-effective for both text and vision
      console.log("🤖 SELECTED MODEL:", selectedModel);
      console.log("📸 IMAGE COUNT:", useVision ? validImageUrls.length : 0);
      console.log("🔍 ALWAYS USING HIGH DETAIL FOR CONSISTENT QUALITY");
      
      const completion = await openai.chat.completions.create({
        model: selectedModel,
        messages: messages,
        // temperature: 1, // GPT-5 Nano only supports default temperature of 1
        max_completion_tokens: 800, // Reduced from 1200 for cost optimization
      });
      const answer = extractAssistantTextFromCompletion(completion) || "Sorry, I couldn't generate an answer.";
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