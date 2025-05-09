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
} from "@shopify/polaris";
import { useState, useCallback } from "react";

// In-memory store context (replace with DB or metafield in production)
// TODO: Replace in-memory storage with persistent storage (DB or Shopify metafield)
let storeContext = "Provide details about your store, products, and policies here.";

export async function loader({}: LoaderFunctionArgs) {
  // In a real app, fetch this from your persistent storage (e.g., Shopify Metafield API)
  return json({ storeContext });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const context = formData.get("context");

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  if (typeof context !== "string" || context.length > 5000) {
    return json({ error: "Invalid or too long context." }, { status: 400 });
  }

  // In a real app, save this to your persistent storage
  storeContext = context;
  console.log("Updated store context:", storeContext);

  // It's often good practice to return the updated data or a success status
  // Returning the context allows the UI to potentially update without a full page reload
  // if using fetcher.Form and handling the fetcher state.
  return json({ success: true, storeContext });
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
          <Card>
            <fetcher.Form method="post">
              <FormLayout>
                <Text variant="bodyMd" as="p">
                  Provide information about your store that the AI assistant can use
                  to answer customer questions. Include details about your brand,
                  unique selling points, return policy, shipping details, etc.
                </Text>
                <TextField
                  label="Store Context"
                  name="context"
                  value={formState}
                  onChange={handleContextChange}
                  multiline={10}
                  autoComplete="off"
                  helpText="Maximum 5000 characters."
                  error={fetcher.data && 'error' in fetcher.data ? fetcher.data.error : undefined}
                />
                <Button submit loading={isSubmitting} variant="primary">
                  {isSubmitting ? "Saving..." : isSaved ? "Saved!" : "Save Context"}
                </Button>
              </FormLayout>
            </fetcher.Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 