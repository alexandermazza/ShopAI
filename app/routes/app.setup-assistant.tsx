import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useNavigation, useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  Layout,
  Button,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";
import OpenAI from "openai";

// OpenAI client will be initialized inside the action function

interface LoaderData {
  shop: string;
  assistantId?: string | null;
}

// This is the loader function that runs on the server when the page is requested.
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  // Fetch store information from the database
  const storeInfo = await prisma.storeInformation.findUnique({
    where: { shop },
  });

  // Pass the assistantId to the frontend
  return json({
    shop,
    assistantId: storeInfo?.assistantId,
  });
}

// This is the action function that runs on the server when the form is submitted.
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  try {
    console.log("Action: Setting up a new assistant...");

    // 1. Check if an assistant already exists for this store to avoid duplicates
    const existingStoreInfo = await prisma.storeInformation.findUnique({
      where: { shop },
    });

    if (existingStoreInfo?.assistantId) {
      console.log("Assistant already exists for this store.");
      return json({
        success: false,
        error: "An assistant already exists for this store.",
      });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    // 2. Create a new Vector Store for the assistant's knowledge base
    console.log("Creating a new Vector Store...");
        const vectorStore = await openai.vectorStores.create({
      name: `Knowledge Base for ${shop}`,
      // We can add expiration policies if needed
      // expires_after: {
      //   anchor: "last_active_at",
      //   days: 1,
      // },
    });
    console.log(`Vector Store created with ID: ${vectorStore.id}`);

    //
    // ** PLACEHOLDER for fetching and uploading files **
    // In the next step, we will add logic here to:
    //   a. Fetch products and images from the Shopify API.
    //   b. Create file streams for product data and images.
    //   c. Upload these files to OpenAI.
    //   d. Add the file IDs to the vector store.
    //
    console.log("Fetching product data from Shopify...");
    const { admin } = await authenticate.admin(request);
    const response = await admin.graphql(
      `#graphql
      query {
        products(first: 25) {
          edges {
            node {
              id
              title
              descriptionHtml
              images(first: 5) {
                edges {
                  node {
                    url
                  }
                }
              }
            }
          }
        }
      }`
    );

    const productsData = await response.json();
    const productEdges = productsData.data.products.edges;
    console.log(`Found ${productEdges.length} products.`);

    const BATCH_SIZE = 5;
    let pendingIds: string[] = [];

    const flushBatch = async () => {
              if (pendingIds.length) {
          // @ts-ignore
        await openai.vectorStores.fileBatches.create({
          vector_store_id: vectorStore.id,
          file_ids: pendingIds,
        });
        console.log(`Attached ${pendingIds.length} files to vector store`);
        pendingIds = [];
      }
    };

    for (const productEdge of productEdges) {
      const product = productEdge.node;

      // 1. Upload product JSON (tiny)
      const jsonId = (
        await openai.files.create({
          // @ts-ignore
          file: Buffer.from(
            JSON.stringify({
              title: product.title,
              description: product.descriptionHtml,
            }),
            "utf-8",
          ),
          purpose: "assistants",
        })
      ).id;
      pendingIds.push(jsonId);

      // 2. Upload each image immediately, streaming to avoid memory blow-up
      for (const imageEdge of product.images.edges) {
        const imageUrl = imageEdge.node.url;
        try {
          const imgRes = await fetch(imageUrl);
          if (imgRes.ok) {
            const id = (
              await openai.files.create({
                // @ts-ignore – stream accepted at runtime
                file: imgRes.body as any,
                purpose: "assistants",
              })
            ).id;
            pendingIds.push(id);
          }
        } catch (err) {
          console.warn(`Could not upload image ${imageUrl}:`, err);
        }

        if (pendingIds.length >= BATCH_SIZE) {
          await flushBatch();
        }
      }
    }

    // Attach any remaining files
    await flushBatch();

    if (!pendingIds.length) {
      console.log("Finished uploading all product files.");
    }

    // 3. Create the Assistant, linking it to the new Vector Store
    console.log("Creating a new Assistant...");
    const assistant = await openai.beta.assistants.create({
      name: `ShopAI Assistant - ${shop}`,
      instructions: `You are a friendly and professional e-commerce assistant for the store: ${shop}.
        Your primary role is to help customers with their questions about products.
        Use the information provided in the files attached to this assistant to answer queries.
        When asked about a specific product, use the File Search tool to find relevant product details, descriptions, and analyze images if necessary.
        Be concise, helpful, and encourage the user to make a purchase if it feels natural.
        Do not make up information. If you cannot find the answer in the provided files, say "I'm sorry, I don't have that information, but I can ask our human team to help."`,
      model: "gpt-4o-mini",
      tools: [{ type: "file_search" }],
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStore.id],
        },
      },
    });
    console.log(`Assistant created with ID: ${assistant.id}`);

    // 4. Save the new IDs to the database
    console.log("Saving IDs to the database...");
    await prisma.storeInformation.upsert({
      where: { shop },
      update: {
        assistantId: assistant.id,
        vectorStoreId: vectorStore.id,
      },
      create: {
        shop,
        assistantId: assistant.id,
        vectorStoreId: vectorStore.id,
      },
    });

    console.log("Assistant setup complete!");
    return json({ success: true, assistantId: assistant.id });
  } catch (error: any) {
    console.error("Error setting up assistant:", error);
    return json({
      success: false,
      error: error.message || "An unknown error occurred.",
    });
  }
}

// This is the React component that renders the page.
export default function SetupAssistantPage() {
  const { assistantId } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const assistantExists = assistantId || (actionData as any)?.assistantId;

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Text variant="headingMd" as="h2">
                AI Assistant Setup
              </Text>
              {assistantExists ? (
                <BlockStack gap="200">
                  <Text as="p" tone="success">
                    Your AI assistant is set up and ready.
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Assistant ID: {assistantExists}
                  </Text>
                </BlockStack>
              ) : (
                <>
                  <Text as="p">
                    Create a dedicated AI assistant for your store. This assistant
                    will be trained on your product information to provide intelligent
                    and context-aware answers to your customers.
                  </Text>
                  <Form method="post">
                    <Button submit disabled={isSubmitting} loading={isSubmitting}>
                      {isSubmitting ? "Creating Assistant..." : "Create Store Assistant"}
                    </Button>
                  </Form>
                </>
              )}
              {actionData && "error" in actionData && (
                <div style={{ color: "red", marginTop: "1rem" }}>
                  Error: {actionData.error}
                </div>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 