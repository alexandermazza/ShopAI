import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  Banner,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  // Fetch store-specific context from database
  const storeInfo = await prisma.storeInformation.findUnique({
    where: { shop: session.shop },
    select: { additionalInfo: true }
  });

  const storeContext = storeInfo?.additionalInfo || "Provide details about your store, products, and policies here.";

  console.log(`[Store Context] Loaded context for shop: ${session.shop}`);

  return json({ storeContext, shop: session.shop });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const context = formData.get("context");

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  if (typeof context !== "string" || context.length > 5000) {
    return json({ error: "Invalid or too long context." }, { status: 400 });
  }

  // Save to database with proper shop isolation
  const storeInfo = await prisma.storeInformation.upsert({
    where: { shop: session.shop },
    update: { additionalInfo: context },
    create: {
      shop: session.shop,
      additionalInfo: context
    }
  });

  console.log(`[Store Context] Updated context for shop: ${session.shop}`);

  return json({ success: true, storeContext: context });
}

// ----- React Component for Admin UI -----
export default function StoreContextAdminPage() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [formState, setFormState] = useState(loaderData.storeContext);
  const [isSaved, setIsSaved] = useState(false);

  const handleContextChange = useCallback((value: string) => {
    setFormState(value);
    setIsSaved(false); // Reset saved state when user types
  }, []);

  // Handle successful submission
  if (fetcher.state === "idle" && fetcher.data && 'success' in fetcher.data && fetcher.data.success && !isSaved) {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  }

  const isSubmitting = fetcher.state === "submitting";

  return (
    <Page title="Store Context for AI">
      <Layout>
        <Layout.Section>
          <Banner tone="warning">
            <p>
              <strong>Privacy Notice:</strong> This information will be shared with ALL your customers through the AI assistant.
              Do NOT include customer-specific data, or sensitive information.
            </p>
          </Banner>
        </Layout.Section>
        <Layout.Section>
          <Banner tone="info">
            <p>
              Store: <strong>{loaderData.shop}</strong> - Your data is private to your store only.
            </p>
          </Banner>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <fetcher.Form method="post">
              <FormLayout>
                <Text variant="bodyMd" as="p">
                  Provide <strong>general information</strong> about your store that the AI can share with customers.
                  Include: brand story, return policy, shipping details, public policies, etc.
                </Text>
                <Text variant="bodyMd" as="p" tone="critical">
                  <strong>Do NOT include:</strong> Customer names, order details, or any customer-specific information.
                </Text>
                <TextField
                  label="Public Store Information"
                  name="context"
                  value={formState}
                  onChange={handleContextChange}
                  multiline={10}
                  autoComplete="off"
                  helpText="Maximum 5000 characters. This information will be visible to all customers asking the AI questions."
                  error={fetcher.data && 'error' in fetcher.data ? fetcher.data.error : undefined}
                />
                <Button submit loading={isSubmitting} variant="primary">
                  {isSubmitting ? "Saving..." : isSaved ? "Saved!" : "Save Context"}
                </Button>
                {isSaved && (
                  <Banner tone="success">
                    <p>Store context saved successfully!</p>
                  </Banner>
                )}
              </FormLayout>
            </fetcher.Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 