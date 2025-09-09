import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  DataTable,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Banner,
  TextField,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { 
  getStoresForReferralPayout, 
  markReferralPaid 
} from "../utils/plan-management.server.js";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // In a real app, you'd want to add authentication here to ensure only admins can access
  const storesNeedingPayout = await getStoresForReferralPayout();
  
  return json({ storesNeedingPayout });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const shop = formData.get("shop") as string;
  const payoutId = formData.get("payoutId") as string;

  if (!shop || !payoutId) {
    return json({ 
      success: false, 
      message: "Shop and payout ID are required" 
    }, { status: 400 });
  }

  try {
    await markReferralPaid(shop, payoutId);
    return json({ 
      success: true, 
      message: `Marked referral for ${shop} as paid (Payout ID: ${payoutId})` 
    });
  } catch (error) {
    return json({ 
      success: false, 
      message: `Error marking payout: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
};

export default function ReferralPayouts() {
  const { storesNeedingPayout } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'basic': return 'success';
      case 'premium': return 'warning';
      case 'enterprise': return 'critical';
      default: return 'info';
    }
  };

  const calculateDaysSinceStart = (planStartDate: string) => {
    const start = new Date(planStartDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const tableRows = storesNeedingPayout.map((store: any) => [
    store.shop,
    store.referralCode,
    <Badge key={`plan-${store.shop}`} tone={getPlanBadgeColor(store.pricingPlan)}>
      {store.pricingPlan.toUpperCase()}
    </Badge>,
    new Date(store.planStartDate).toLocaleDateString(),
    `${calculateDaysSinceStart(store.planStartDate)} days`,
    <Form key={`form-${store.shop}`} method="post" style={{ display: 'inline-block' }}>
      <input type="hidden" name="shop" value={store.shop} />
      <InlineStack gap="200">
        <TextField
          name="payoutId"
          placeholder="Payout ID"
          autoComplete="off"
          label=""
        />
        <Button submit size="slim" variant="primary">
          Mark Paid
        </Button>
      </InlineStack>
    </Form>
  ]);

  return (
    <Page title="Referral Payouts">
      <TitleBar title="Referral Payouts" />
      
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
              <InlineStack gap="200" align="space-between">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingLg">💰 Pending Referral Payouts</Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Stores with paid plans that signed up with referral codes and haven't been paid out yet.
                  </Text>
                </BlockStack>
                <Badge tone="info">
                  {storesNeedingPayout.length} pending
                </Badge>
              </InlineStack>
              
              {storesNeedingPayout.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                  headings={['Store', 'Referral Code', 'Plan', 'Plan Start Date', 'Days Active', 'Action']}
                  rows={tableRows}
                  increasedTableDensity
                  hoverable
                />
              ) : (
                <EmptyState
                  heading="No pending payouts"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>All referral payouts are up to date!</p>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">📋 Payout Process</Text>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  <Text as="span" fontWeight="semibold">1. Identify Referrers:</Text> Use the referral code to identify who should receive the payout.
                </Text>
                <Text as="p" variant="bodyMd">
                  <Text as="span" fontWeight="semibold">2. Process Payment:</Text> Send payment to the referrer through your preferred method.
                </Text>
                <Text as="p" variant="bodyMd">
                  <Text as="span" fontWeight="semibold">3. Record Payout ID:</Text> Enter the transaction/payout ID and click "Mark Paid" to prevent duplicate payments.
                </Text>
                <Text as="p" variant="bodyMd">
                  <Text as="span" fontWeight="semibold">4. Keep Records:</Text> The payout ID is stored for audit purposes and dispute resolution.
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}