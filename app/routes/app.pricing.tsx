import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Box,
  Divider,
  List,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { requestSubscription, getBillingStatus } from "../utils/billing-check.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Import server-only modules in loader
  const { BILLING_PLANS, PLAN_FEATURES } = await import("../utils/billing.server");

  // Get current billing status
  const billingStatus = await getBillingStatus(admin);

  return json({
    shop: session.shop,
    hasActivePayment: billingStatus.hasActivePayment,
    plan: PLAN_FEATURES[BILLING_PLANS.PRO],
    planName: BILLING_PLANS.PRO,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const selectedPlan = formData.get("plan") as string;

  if (!selectedPlan) {
    return json({ error: "Please select a plan" }, { status: 400 });
  }

  try {
    // Request subscription from Shopify
    const billingResponse = await requestSubscription(
      admin,
      selectedPlan,
      `${process.env.SHOPIFY_APP_URL}/app/billing/callback?plan=${selectedPlan}`
    );

    // Redirect to Shopify's confirmation URL
    if (billingResponse && billingResponse.confirmationUrl) {
      return redirect(billingResponse.confirmationUrl);
    }

    return json({ error: "Failed to initiate billing" }, { status: 500 });
  } catch (error) {
    console.error("[Pricing] Error requesting subscription:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to process subscription" },
      { status: 500 }
    );
  }
};

export default function Pricing() {
  const { shop, hasActivePayment, plan, planName } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <Page title="Subscription">
      <TitleBar title="Subscription" />

      <Layout>
        {hasActivePayment && (
          <Layout.Section>
            <Banner title="Active Subscription" tone="success">
              <p>
                You're currently subscribed to ShopAI <strong>{planName}</strong> at ${plan.price}/month.
              </p>
            </Banner>
          </Layout.Section>
        )}

        {!hasActivePayment && (
          <Layout.Section>
            <Banner title="Subscribe to ShopAI Pro" tone="info">
              <p>
                Subscribe to unlock unlimited AI-powered customer questions and advanced features.
              </p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineStack gap="600" align="center">
            <Box width="50%">
              <Card>
                <BlockStack gap="500">
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h2" variant="headingLg">
                        {planName}
                      </Text>
                      {hasActivePayment && <Badge tone="success">Active</Badge>}
                    </InlineStack>

                    <Box>
                      <Text as="p" variant="heading2xl" fontWeight="bold">
                        ${plan.price}
                      </Text>
                      <Text as="span" variant="bodyLg" tone="subdued">
                        per month
                      </Text>
                    </Box>

                    {!hasActivePayment && (
                      <Badge tone="attention" size="large">
                        Subscription required
                      </Badge>
                    )}
                  </BlockStack>

                  <Divider />

                  <BlockStack gap="300">
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Everything you need to engage customers:
                    </Text>
                    <List type="bullet">
                      <List.Item>
                        <Text as="span" fontWeight="semibold">Unlimited</Text> AI-powered customer questions
                      </List.Item>
                      <List.Item>Advanced AI chat with GPT-5 Nano</List.Item>
                      <List.Item>Detailed analytics dashboard</List.Item>
                      <List.Item>Question tracking & insights</List.Item>
                      <List.Item>AI review summaries</List.Item>
                      <List.Item>Priority customer support</List.Item>
                      <List.Item>Custom store branding</List.Item>
                    </List>
                  </BlockStack>

                  <Divider />

                  <Form method="post">
                    <input type="hidden" name="plan" value={planName} />
                    <Button
                      variant="primary"
                      size="large"
                      disabled={hasActivePayment || isSubmitting}
                      submit
                      fullWidth
                    >
                      {hasActivePayment
                        ? "Already Subscribed"
                        : "Subscribe Now"}
                    </Button>
                  </Form>

                  {!hasActivePayment && (
                    <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                      Billed monthly through Shopify. Cancel anytime from your Shopify admin.
                    </Text>
                  )}
                </BlockStack>
              </Card>
            </Box>

            <Box width="40%">
              <BlockStack gap="400">
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">
                      Why ShopAI?
                    </Text>
                    <List>
                      <List.Item>
                        <Text as="span" fontWeight="semibold">Boost conversions</Text> - Answer customer questions instantly, 24/7
                      </List.Item>
                      <List.Item>
                        <Text as="span" fontWeight="semibold">Save time</Text> - Reduce support tickets with AI-powered responses
                      </List.Item>
                      <List.Item>
                        <Text as="span" fontWeight="semibold">Increase trust</Text> - Provide instant, accurate product information
                      </List.Item>
                    </List>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">
                      Questions about billing?
                    </Text>
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd">
                        <Text as="span" fontWeight="semibold">Instant activation:</Text> Access all features immediately after subscribing.
                      </Text>
                      <Text as="p" variant="bodyMd">
                        <Text as="span" fontWeight="semibold">Cancel anytime:</Text> No long-term commitment. Cancel your subscription at any time.
                      </Text>
                      <Text as="p" variant="bodyMd">
                        <Text as="span" fontWeight="semibold">Billing:</Text> Charged monthly through your Shopify account.
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </Card>
              </BlockStack>
            </Box>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
