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

  // Helper function to intelligently select images based on question type
  const selectRelevantImages = (imageUrls: string[], question: string, productContext: string) => {
    const questionLower = question.toLowerCase();
    const contextLower = productContext.toLowerCase();
    
    // If question is about nutrition/ingredients, prioritize images that likely contain labels
    if (questionLower.includes('nutrition') || questionLower.includes('ingredient') || 
        questionLower.includes('calorie') || questionLower.includes('label')) {
      // Return first 2-3 images (usually main product + nutrition label)
      return imageUrls.slice(0, Math.min(3, imageUrls.length));
    }
    
    // If question is about size/dimensions, prioritize images that show the product clearly
    if (questionLower.includes('size') || questionLower.includes('dimension') || 
        questionLower.includes('measurement') || questionLower.includes('weight')) {
      // Return first 2 images (usually main product + size chart)
      return imageUrls.slice(0, Math.min(2, imageUrls.length));
    }
    
    // If question is about color/appearance, prioritize first image (main product view)
    if (questionLower.includes('color') || questionLower.includes('look') || 
        questionLower.includes('appear') || questionLower.includes('visual')) {
      return imageUrls.slice(0, Math.min(2, imageUrls.length));
    }
    
    // For general questions, use first 3 images (good balance of cost vs coverage)
    return imageUrls.slice(0, Math.min(3, imageUrls.length));
  };

  // Helper function to compress product context for cost optimization
  const compressProductContext = (context: string, question: string) => {
    const questionLower = question.toLowerCase();
    
    // If question is very specific, we can be more aggressive with compression
    if (questionLower.includes('nutrition') || questionLower.includes('ingredient') || 
        questionLower.includes('calorie') || questionLower.includes('label')) {
      // Keep nutrition-related content, remove marketing fluff
      const lines = context.split('\n');
      const relevantLines = lines.filter(line => 
        line.toLowerCase().includes('nutrition') || 
        line.toLowerCase().includes('ingredient') || 
        line.toLowerCase().includes('calorie') || 
        line.toLowerCase().includes('serving') ||
        line.toLowerCase().includes('dietary') ||
        line.toLowerCase().includes('allergen')
      );
      return relevantLines.join('\n') || context; // Fallback to original if no relevant lines
    }
    
    // For size/dimension questions, prioritize size-related content
    if (questionLower.includes('size') || questionLower.includes('dimension') || 
        questionLower.includes('measurement') || questionLower.includes('weight')) {
      const lines = context.split('\n');
      const relevantLines = lines.filter(line => 
        line.toLowerCase().includes('size') || 
        line.toLowerCase().includes('dimension') || 
        line.toLowerCase().includes('measurement') || 
        line.toLowerCase().includes('weight') ||
        line.toLowerCase().includes('height') ||
        line.toLowerCase().includes('width') ||
        line.toLowerCase().includes('length')
      );
      return relevantLines.join('\n') || context;
    }
    
    // For general questions, keep first 2000 characters (good balance)
    if (context.length > 2000) {
      return context.substring(0, 2000) + '...';
    }
    
    return context;
  };

  // Helper function to build messages with optional images
  const buildMessagesWithImages = (textContent: string, imageUrls: string[] = []) => {
    const content: any[] = [{ type: "text", text: textContent }];
    
    // Use intelligent image selection instead of fixed limit
    imageUrls.forEach(imageUrl => {
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
      
      // For suggested questions, use even more conservative image selection (max 2 images)
      const selectedImagesForSuggestions = useVisionForSuggestions ? validImageUrls.slice(0, 2) : [];
      
      // For suggested questions, use a more general compression (keep first 1500 chars)
      const compressedContextForSuggestions = productContext.length > 1500 ? 
        productContext.substring(0, 1500) + '...' : productContext;
      
      const imageAnalysisNote = useVisionForSuggestions ? 
        `\n\nIMPORTANT: I have also provided ${selectedImagesForSuggestions.length} product image(s) for analysis. Please examine these images for details like nutritional information, specifications, ingredients, care instructions, or other details that might not be mentioned in the text description. Include questions about information visible in the images.` : '';
      
      const prompt = `
        Generate exactly 3 distinct, concise questions that customers might ask about this product and store. Make the questions short, clickable, and relevant.

        IMPORTANT: Look at both the Product Information AND Store Information sections. Include questions about:
        - Product features, specifications, or details
        - Store policies (shipping, returns, warranties) if available
        - Services or support if mentioned${imageAnalysisNote}

        Format: One question per line, no numbering, no quotes, no prefixes.

        Product Information:
        ---
        ${compressedContextForSuggestions}
        ---${storeContext}

        Generate 3 relevant questions:
      `;
      console.log("📤 Sending prompt to OpenAI for suggested questions with", prompt.length, "characters");
      console.log("📸 Using vision for suggestions:", useVisionForSuggestions, "| Including", useVisionForSuggestions ? selectedImagesForSuggestions.length : 0, "images");
      console.log("💰 SUGGESTIONS COST SAVINGS: Using", selectedImagesForSuggestions.length, "of", validImageUrls.length, "available images");
      
      const messages = buildMessagesWithImages(prompt, useVisionForSuggestions ? selectedImagesForSuggestions : []);
      
      const completion = await openai.chat.completions.create({
        model: useVisionForSuggestions ? "gpt-4o-mini" : "gpt-4.1-nano-2025-04-14", // GPT-4o-mini for vision, GPT-4.1 nano for text
        messages: messages,
        temperature: 0.7,
        max_tokens: 400, // Reduced from 800 for cost optimization
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
      const needsVision = requiresVision(question);
      const hasImages = validImageUrls.length > 0;
      const useVision = hasImages && needsVision;
      
      // Use intelligent image selection to reduce costs while maintaining quality
      const selectedImages = useVision ? selectRelevantImages(validImageUrls, question, productContext) : [];
      
      // Compress product context for cost optimization
      const compressedContext = compressProductContext(productContext, question);
      const contextCompressionRatio = Math.round((1 - compressedContext.length / productContext.length) * 100);
      
      console.log("🔍 VISION DEBUG - Question:", question);
      console.log("🔍 VISION DEBUG - needsVision:", needsVision);
      console.log("🔍 VISION DEBUG - hasImages:", hasImages);
      console.log("🔍 VISION DEBUG - useVision:", useVision);
      console.log("🔍 VISION DEBUG - Total images available:", validImageUrls.length);
      console.log("🔍 VISION DEBUG - Selected images for analysis:", selectedImages.length);
      console.log("🔍 VISION DEBUG - Cost savings:", validImageUrls.length - selectedImages.length, "images filtered out");
      console.log("📝 CONTEXT COMPRESSION: Reduced from", productContext.length, "to", compressedContext.length, "characters (", contextCompressionRatio, "% reduction)");
      
      const imageAnalysisNote = useVision ? 
        `\n\nIMAGE ANALYSIS INSTRUCTIONS: I have provided ${selectedImages.length} product image(s) that you MUST analyze carefully. These images contain important product information that you should read and use to answer questions.

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
      console.log("🤖 Selected model:", useVision ? "gpt-4o-mini" : "gpt-4.1-nano-2025-04-14");
      console.log("📋 Product context length:", productContext?.length || 0);
      console.log("🏪 Store context length:", storeContext?.length || 0);
      console.log("📸 Including", useVision ? selectedImages.length : 0, "images for analysis");
      
      // Always use high detail for consistent quality when using vision
      
      const messages = buildMessagesWithImages(prompt, useVision ? selectedImages : []);
      
      const selectedModel = useVision ? "gpt-4o-mini" : "gpt-4.1-nano-2025-04-14"; // Use full GPT-4o for better vision, GPT-4.1 nano for text
      console.log("🤖 SELECTED MODEL:", selectedModel);
      console.log("📸 IMAGE COUNT:", useVision ? selectedImages.length : 0);
      console.log("🔍 ALWAYS USING HIGH DETAIL FOR CONSISTENT QUALITY");
      console.log("💰 COST SAVINGS: Reduced from", validImageUrls.length, "to", selectedImages.length, "images (", Math.round((1 - selectedImages.length / validImageUrls.length) * 100), "% reduction)");
      
      const completion = await openai.chat.completions.create({
        model: selectedModel,
        messages: messages,
        temperature: 0.3, // Reduced for more consistent responses
        max_tokens: 800, // Reduced from 1200 for cost optimization
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