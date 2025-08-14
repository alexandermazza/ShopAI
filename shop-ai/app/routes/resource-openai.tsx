// shop-ai/app/routes/resource-openai.tsx - Pure resource route file
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import OpenAI from "openai";
// @ts-ignore - db.server.js is a JavaScript file
import prisma from "../db.server.js";

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
  
  return sections.length > 0 ? `\n\nStore Information:\n---\n${sections.join('\n')}\n---\n` : "";
}

// Helper function to determine if question needs vision analysis
function requiresVision(question: string) {
  const visionKeywords = [
    'color', 'size', 'dimension', 'look', 'appear', 'see', 'show', 'visual',
    'nutritional', 'nutrition', 'ingredient', 'label', 'package', 'packaging',
    'measurement', 'weight', 'height', 'width', 'length', 'calories',
    'specification', 'spec', 'instruction', 'warning', 'image', 'picture',
    'care', 'wash', 'clean', 'material', 'fabric', 'texture'
  ];
  
  const questionLower = question.toLowerCase();
  return visionKeywords.some(keyword => questionLower.includes(keyword));
}

// Helper function to build messages with optional images
function buildMessagesWithImages(textContent: string, imageUrls: string[] = []) {
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
}

// Extract assistant text robustly from OpenAI chat.completions result
function extractAssistantTextFromCompletion(completion: any): string {
  console.log("🔧 EXTRACTION DEBUG - Starting text extraction");
  try {
    const message = completion?.choices?.[0]?.message;
    console.log("🔧 EXTRACTION DEBUG - Message:", message);
    const content = message?.content;
    console.log("🔧 EXTRACTION DEBUG - Content type:", typeof content);
    console.log("🔧 EXTRACTION DEBUG - Content value:", content);
    
    if (typeof content === 'string') {
      console.log("🔧 EXTRACTION DEBUG - Found string content, length:", content.length);
      return content.trim();
    }
    if (Array.isArray(content)) {
      console.log("🔧 EXTRACTION DEBUG - Found array content, length:", content.length);
      const text = content
        .map((part: any) => {
          console.log("🔧 EXTRACTION DEBUG - Processing part:", part);
          if (typeof part === 'string') return part;
          if (typeof part?.text === 'string') return part.text;
          if (part?.type === 'output_text' && typeof part?.output_text?.content === 'string') {
            return part.output_text.content;
          }
          return '';
        })
        .join(' ')
        .trim();
      console.log("🔧 EXTRACTION DEBUG - Final array text:", text);
      return text;
    }
    console.log("🔧 EXTRACTION DEBUG - Content is neither string nor array");
  } catch (error) {
    console.error("🔧 EXTRACTION DEBUG - Error during extraction:", error);
  }
  console.log("🔧 EXTRACTION DEBUG - Returning empty string");
  return '';
}

// No default export - this makes it a resource route!

// Action function to handle POST requests
export async function action({ request }: ActionFunctionArgs) {
  console.log("🚀 RESOURCE-OPENAI ROUTE HIT!");
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Extract shop from URL query parameters (App Proxy sends it in URL)
    const url = new URL(request.url);
    const shopFromUrl = url.searchParams.get('shop') || '';
    
    // Read the potential fields from JSON body
    const { operation, question, productContext, language, toneOfVoice, productImages } = await request.json();

    // Get store information - shop comes from URL query params in App Proxy
    const shopDomain = shopFromUrl || request.headers.get('x-shop-domain') || '';
    console.log("🏪 Shop domain:", shopDomain);
    
    const storeInfo = await getStoreInformation(shopDomain);
    console.log("🏪 Store info found:", storeInfo ? "Yes" : "No");
    
    const storeContext = buildStoreContext(storeInfo);
    console.log("🏪 Store context length:", storeContext.length);
    if (storeContext.length > 0) {
      console.log("📋 Store context:", storeContext);
    }

    // Process product images for AI analysis
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

    // --- VALIDATION ---
    if (!productContext) {
        return json({ error: "Missing product context" }, { status: 400 });
    }
    
    const MAX_CONTEXT_LENGTH = 15000; // Significantly increased to handle comprehensive product and store context
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
      console.log("📤 Operation: getSuggestedQuestions");
      
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
        Generate exactly 3 distinct, concise questions that customers might ask about this product and store. Make the questions short, clickable, and relevant.

        IMPORTANT: Look at both the Product Information AND Store Information sections. Include questions about:
        - Product features, specifications, or details
        - Store policies (shipping, returns, warranties) if available
        - Services or support if mentioned${imageAnalysisNote}

        Format: One question per line, no numbering, no quotes, no prefixes.

        Product Information:
        ---
        ${productContext}
        ---${storeContext}

        Generate 3 relevant questions:
      `;
      
      console.log("📤 Sending prompt to OpenAI for suggested questions with", prompt.length, "characters");
      console.log("📸 Using vision for suggestions:", useVisionForSuggestions, "| Including", useVisionForSuggestions ? validImageUrls.length : 0, "images");
      
      // Build messages; for suggestions we don't need a separate system message
      const messagesForSuggestions = buildMessagesWithImages(prompt, useVisionForSuggestions ? validImageUrls : []);
      
      const completion = await openai.chat.completions.create({
        model: useVisionForSuggestions ? "gpt-4o" : "gpt-4.1-nano-2025-04-14",
        messages: messagesForSuggestions,
        max_tokens: 200,
      });

      const finalContent = completion.choices[0]?.message?.content?.trim() ?? "";
      
      if (!finalContent) {
        console.error("OpenAI did not return content for suggested questions.");
        return json({ error: "Could not generate suggested questions" }, { status: 500 });
      }

      // Parse the response as simple lines instead of JSON
      const suggestedQuestions = finalContent.split('\n').map(q => q.trim()).filter(q => q.length > 0).slice(0, 3);
      return json({ suggestions: { questions: suggestedQuestions } });

    } else {
      // --- ANSWER QUESTION (DEFAULT OPERATION) ---
      console.log("📤 Operation: answerQuestion (default)");
      console.log("🔍 Question asked:", question);
      console.log("📋 Product context length:", productContext?.length || 0);
      console.log("📸 Including", validImageUrls.length, "images for analysis");
      
      // Validate required 'question' field for this operation
      if (!question) {
          return json({ error: "Missing question field for this operation" }, { status: 400 });
      }
      const MAX_QUESTION_LENGTH = 300;
      if (question.length > MAX_QUESTION_LENGTH) {
          return json({ error: `Question exceeds maximum length of ${MAX_QUESTION_LENGTH} characters.` }, { status: 400 });
      }

      // Store question for analytics (non-blocking)
      try {
        console.log("💾 Attempting to log question for shop:", shopDomain);
        if (shopDomain && question) {
          // Less aggressive normalization - keep punctuation but normalize case and whitespace
          const normalizedQuestion = question.trim().toLowerCase().replace(/\s+/g, " ");
          console.log("💾 Original question:", question);
          console.log("💾 Normalized question:", normalizedQuestion);

          if (normalizedQuestion && normalizedQuestion.length > 0) {
            console.log("💾 Executing upsert for:", { shop: shopDomain, question: normalizedQuestion });
            
            // Use correct Prisma syntax for compound unique constraint
            await prisma.customerQuestion.upsert({
              where: { 
                shop_question: { 
                  shop: shopDomain, 
                  question: normalizedQuestion 
                } 
              },
              update: { 
                times: { increment: 1 },
                askedAt: new Date() // Update the timestamp too
              },
              create: { 
                shop: shopDomain, 
                question: normalizedQuestion 
              },
            });
            console.log("💾 ✅ Question stored successfully for shop:", shopDomain);
          } else {
            console.warn("💾 ⚠️ Normalized question is empty. Skipping storage.");
          }
        } else {
          console.warn("💾 ⚠️ Missing shop domain or question. Skipping storage.");
        }
      } catch (dbError) {
        console.error("💾 ❌ DATABASE ERROR while recording question:", dbError);
        console.error("💾 Error details:", {
          message: dbError instanceof Error ? dbError.message : String(dbError),
          code: (dbError as any)?.code || 'unknown',
          stack: dbError instanceof Error ? dbError.stack : undefined
        });
        // Do not block the user's request if logging fails
      }

      const needsVision = requiresVision(question);
      const hasImages = validImageUrls.length > 0;
      const useVision = hasImages && needsVision;
      
      const imageAnalysisNote = validImageUrls.length > 0 ? 
        `\n\nIMAGE ANALYSIS: I have provided ${validImageUrls.length} product image(s) for you to analyze. Please examine these images carefully for details such as:
        - Nutritional information, ingredients, or dietary specifications
        - Product dimensions, measurements, or size information  
        - Care instructions, usage guidelines, or warnings
        - Technical specifications, model numbers, or certifications
        - Visual features, colors, textures, or design details
        - Any text, labels, or annotations visible in the images
        - Packaging information or included accessories
        
        Use information from the images to provide more complete and accurate answers. If the question relates to something visible in the images, prioritize that visual information.` : '';

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
        
        FORMATTING RULES:
        - Keep responses concise and conversational (2-3 sentences max)
        - Use plain text only - NO markdown, asterisks, or special formatting
        - Write in a natural, friendly tone
        - Focus on the most important details first

        Product Information:
        ---
        ${productContext}
        ---${storeContext}

        User Question: ${question}

        Answer (be specific, concise, and use plain text only):
      `;

      console.log("📤 Sending prompt to OpenAI for answer with", prompt.length, "characters");
      console.log("🧠 Vision needed:", needsVision, "| Has images:", hasImages, "| Using vision:", useVision);
      console.log("📝 Question for vision analysis:", question);
  
      const gptPayload: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
        messages: buildMessagesWithImages(prompt, validImageUrls),
        model: useVision ? "gpt-4o" : "gpt-4.1-nano-2025-04-14",
        max_tokens: 220,
      };
  
      const completion = await openai.chat.completions.create(gptPayload);

      let answer = completion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't generate an answer.";
      
      // Remove common markdown formatting
      answer = answer
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove **bold**
        .replace(/\*(.*?)\*/g, '$1')     // Remove *italic*
        .replace(/__(.*?)__/g, '$1')     // Remove __underline__
        .replace(/_(.*?)_/g, '$1')       // Remove _italic_
        .replace(/`(.*?)`/g, '$1')       // Remove `code`
        .replace(/#{1,6}\s*/g, '')       // Remove # headers
        .trim();
        
      return json({ answer });
    }

  } catch (error) {
    console.error("❌ Error in resource-openai route:", error);
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