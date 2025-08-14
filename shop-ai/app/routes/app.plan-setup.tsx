import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useActionData, Form } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  TextField,
  Select,
  BlockStack,
  InlineStack,
  Banner,
  Badge,
  Box,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server.js";
import { updateStoreReferralCode } from "../utils/plan-management.server.js";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  return json({ shop: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const referralCode = formData.get("referralCode") as string;

  if (!referralCode || referralCode.trim() === "") {
    return json({ 
      success: false, 
      message: "Please enter a referral code" 
    }, { status: 400 });
  }

  try {
    // Update the referral code only
    await updateStoreReferralCode({
      shop: session.shop,
      referralCode: referralCode.trim(),
    });

    return json({ success: true, message: "Referral code submitted successfully!" });
  } catch (error) {
    return json({ 
      success: false, 
      message: `Error submitting referral code: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 400 });
  }
};

export default function PlanSetup() {
  const { shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  const [referralCode, setReferralCode] = useState("");

  return (
    <Page title="Referral Code Setup">
      <TitleBar title="Referral Code Setup" />
      
      <Layout>
        <Layout.Section>
          {actionData?.success && (
            <Banner title="Success!" tone="success">
              <p>{actionData.message}</p>
            </Banner>
          )}
          
          {actionData?.success === false && (
            <Banner title="Error" tone="critical">
              <p>{actionData.message}</p>
            </Banner>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text as="h2" variant="headingLg">Submit Your Referral Code</Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  If you signed up through a referral, enter the code here to ensure proper attribution and referrer payout.
                </Text>
              </BlockStack>
              
              <Form method="post">
                <BlockStack gap="400">
                  <TextField
                    label="Referral Code"
                    value={referralCode}
                    onChange={setReferralCode}
                    name="referralCode"
                    placeholder="Enter your referral code"
                    helpText="This code links your account to the person who referred you, ensuring they receive proper credit."
                    requiredIndicator
                  />

                  <InlineStack gap="200">
                    <Button variant="primary" submit>
                      Submit Referral Code
                    </Button>
                    <Button onClick={() => navigate("/app/dashboard")}>
                      Back to Dashboard
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">💡 About Referral Codes</Text>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  <Text as="span" fontWeight="semibold">Why enter a referral code?</Text> Referral codes help us track who introduced you to ShopAI, ensuring they receive proper recognition and compensation for their referral.
                </Text>
                <Text as="p" variant="bodyMd">
                  <Text as="span" fontWeight="semibold">When to submit:</Text> Submit your referral code as soon as possible after installation. This ensures proper attribution from the start.
                </Text>
                <Text as="p" variant="bodyMd">
                  <Text as="span" fontWeight="semibold">Don't have a code?</Text> No worries! Referral codes are optional. You can still use ShopAI without one.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}