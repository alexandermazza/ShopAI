// shop-ai/app/routes/api.resource-openai.tsx - Pure resource route file
import type { ActionFunctionArgs } from "@remix-run/node";
// Use json from remix, use global Response
import { json } from "@remix-run/node";
// Use specific AI SDK packages for v3+
import { openai } from '@ai-sdk/openai'; // Correct export: lowercase 'openai'
import { streamText } from 'ai'; // Use core streamText
// @ts-ignore
import prisma from "../db.server";

// No client initialization needed here for basic usage

// No default export - this makes it a resource route!

// Action function to handle POST requests
export async function action({ request }: ActionFunctionArgs) {
  console.log("RESOURCE-OPENAI ROUTE HIT (STREAMING v4 - Direct Provider)!");

  if (request.method !== "POST") {
    // Return simple Response for errors
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { question, productContext, shop } = await request.clone().json();

    if (!question || !productContext) {
       return new Response("Missing question or product context", { status: 400 });
    }

    // Add server-side validation for input lengths
    const MAX_QUESTION_LENGTH = 300;
    const MAX_CONTEXT_LENGTH = 5000; // Adjust as needed

    if (question.length > MAX_QUESTION_LENGTH) {
      return new Response(`Question exceeds maximum length of ${MAX_QUESTION_LENGTH} characters.`, { status: 400 });
    }

    if (productContext.length > MAX_CONTEXT_LENGTH) {
      console.warn(`Product context truncated for OpenAI call. Original length: ${productContext.length}`);
       return new Response(`Product context exceeds maximum length of ${MAX_CONTEXT_LENGTH} characters.`, { status: 400 });
    }

    // Normalize and save the question for analytics
    try {
      console.log("Attempting to log question for shop:", shop);
      if (!shop) {
        console.warn("Shop domain not provided in request body. Skipping question logging.");
      } else {
        // Less aggressive normalization - keep punctuation but normalize case and whitespace
        const normalizedQuestion = question.trim().toLowerCase().replace(/\s+/g, " ");
        console.log("Original question:", question);
        console.log("Normalized question:", normalizedQuestion);

        if (normalizedQuestion && normalizedQuestion.length > 0) {
          console.log("Executing upsert for:", { shop, question: normalizedQuestion });
          
          // Fixed: Use correct Prisma syntax for compound unique constraint
          await prisma.customerQuestion.upsert({
            where: { 
              shop_question: { 
                shop: shop, 
                question: normalizedQuestion 
              } 
            },
            update: { 
              times: { increment: 1 },
              askedAt: new Date() // Update the timestamp too
            },
            create: { 
              shop: shop, 
              question: normalizedQuestion 
            },
          });
          console.log("Upsert completed successfully for shop:", shop);
        } else {
          console.warn("Normalized question is empty. Skipping upsert.");
        }
      }
    } catch (dbError) {
      console.error("DATABASE ERROR while recording question:", dbError);
      console.error("Error details:", {
        message: dbError instanceof Error ? dbError.message : String(dbError),
        code: (dbError as any)?.code || 'unknown',
        stack: dbError instanceof Error ? dbError.stack : undefined
      });
      // Do not block the user's request if logging fails
    }

    // API Key check is implicitly handled by the SDK if process.env.OPENAI_API_KEY is set
    // Or you can pass it explicitly in the model call if needed
    // if (!process.env.OPENAI_API_KEY) {
    //   return new Response("OpenAI API key not configured", { status: 500 });
    // }

    const prompt = `You are a product specialist for an online store. Your job is to answer customer questions with clarity, confidence, and a touch of marketing flair.
    You may make reasonable inferences based on the product details provided. Use context clues, related attributes, and common product knowledge to fill in gaps if necessary.
    When the user refers to "this" or "it" etc, assume they are referring to the product in the product context.
    If you're truly unsure, say: "I'm not certain based on the current product details."
    Be helpful, and friendly.

    When answering questions about reviews:
    *   DO NOT list individual reviews verbatim.
    *   Instead, SUMMARIZE the overall sentiment.
    *   Identify recurring themes, both positive (highlights) and negative (major criticisms).
    *   Mention the general consensus or any significant disagreements among reviewers.

    Product Information:
    ---
    ${productContext}
    ---

    User Question: ${question}

    Answer:`;

    // Use streamText, passing the provider function directly for the model
    const result = await streamText({
      // Call the imported openai function with just the model ID
      model: openai('gpt-4o-mini'), 
      prompt: prompt,
      // Pass temperature and maxTokens directly to streamText
      temperature: 0.9,
      maxTokens: 180,
    });

    // Return a global Response object with the stream
    return new Response(result.toDataStream(), {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }, // Set appropriate content type
    });

  } catch (error) {
    console.error("Error in resource-openai route:", error);
    let errorMessage = "An error occurred processing your request.";
    if (error instanceof Error) {
       // Consider logging the full error stack trace for debugging
       // console.error(error.stack);
       errorMessage = error.message; // Provide a more generic message or specific if safe
    }
     // Return a global Response object for errors
     return new Response(`Error: ${errorMessage}`, { status: 500 });
  }
}

// Loader function to handle GET requests (optional)
// Keep this as JSON response
export async function loader() {
  console.log("RESOURCE-OPENAI GET REQUEST!");
  return json({ status: "OpenAI API endpoint is operational (streaming v4 - Direct Provider)" });
} 