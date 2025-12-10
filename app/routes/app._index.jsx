import { useEffect, useState } from "react";
import { useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  Badge,
  TextField,
  Button,
  Banner,
  Tabs,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
// @ts-ignore - db.server.js is a JavaScript file
import { prisma } from "../db.server";
import { getBillingStatus } from "../utils/billing-check.server";
import { UsageMeter } from "../components/UsageMeter";
import { UpgradeBanner } from "../components/UpgradeBanner";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  // Check billing status
  const billingStatus = await getBillingStatus(admin);

  // Load store information directly from database
  let storeInfo = null;
  try {
    storeInfo = await prisma.storeInformation.findUnique({
      where: { shop: session.shop }
    });
    console.log("📝 Loaded store info for shop:", session.shop, storeInfo ? "Found" : "Not found");
  } catch (error) {
    console.error("Error loading store information:", error);
  }

  // Calculate reset date (first day of next month)
  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    storeInfo,
    hasActivePayment: billingStatus.hasActivePayment,
    usage: storeInfo ? {
      questionsUsed: storeInfo.monthlyQuestions || 0,
      summariesUsed: storeInfo.reviewSummariesGenerated || 0,
      resetDate: resetDate.toISOString(),
    } : null,
  };
};

export default function Index() {
  const app = useAppBridge();
  const { storeInfo, hasActivePayment, usage } = useLoaderData();
  const fetcher = useFetcher();
  const [searchParams] = useSearchParams();

  const [selectedTab, setSelectedTab] = useState(0);
  const [formData, setFormData] = useState({
    storeName: storeInfo?.storeName || "",
    storeDescription: storeInfo?.storeDescription || "",
    shippingPolicy: storeInfo?.shippingPolicy || "",
    returnPolicy: storeInfo?.returnPolicy || "",
    storeHours: storeInfo?.storeHours || "",
    contactInfo: storeInfo?.contactInfo || "",
    specialServices: storeInfo?.specialServices || "",
    aboutUs: storeInfo?.aboutUs || "",
    additionalInfo: storeInfo?.additionalInfo || "",
  });
  
  // App Bridge initialization check
  useEffect(() => {
    console.log("🟢 ShopAI app loaded, checking App Bridge...");
    
    if (app) {
      console.log("🟢 App Bridge initialized successfully");
      
      if (app.getSessionToken) {
        app.getSessionToken().then(token => {
          console.log("🟢 Session token validated successfully");
        }).catch(error => {
          console.error("🔴 Session token validation failed", error);
        });
      }
    } else {
      console.error("🔴 App Bridge not initialized");
    }
  }, [app]);

  // Update form data when store info loads
  useEffect(() => {
    if (storeInfo) {
      setFormData({
        storeName: storeInfo.storeName || "",
        storeDescription: storeInfo.storeDescription || "",
        shippingPolicy: storeInfo.shippingPolicy || "",
        returnPolicy: storeInfo.returnPolicy || "",
        storeHours: storeInfo.storeHours || "",
        contactInfo: storeInfo.contactInfo || "",
        specialServices: storeInfo.specialServices || "",
        aboutUs: storeInfo.aboutUs || "",
        additionalInfo: storeInfo.additionalInfo || "",
      });
    }
  }, [storeInfo]);

  // Update form data after successful save
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.storeInfo) {
      setFormData({
        storeName: fetcher.data.storeInfo.storeName || "",
        storeDescription: fetcher.data.storeInfo.storeDescription || "",
        shippingPolicy: fetcher.data.storeInfo.shippingPolicy || "",
        returnPolicy: fetcher.data.storeInfo.returnPolicy || "",
        storeHours: fetcher.data.storeInfo.storeHours || "",
        contactInfo: fetcher.data.storeInfo.contactInfo || "",
        specialServices: fetcher.data.storeInfo.specialServices || "",
        aboutUs: fetcher.data.storeInfo.aboutUs || "",
        additionalInfo: fetcher.data.storeInfo.additionalInfo || "",
      });
      console.log("📝 Form data updated after successful save");
    }
  }, [fetcher.data]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveStoreInfo = () => {
    fetcher.submit(formData, {
      method: "POST",
      action: "/app/store-information",
      encType: "application/json"
    });
  };

  const isLoading = fetcher.state === "submitting";
  const showSuccess = fetcher.data?.success;
  const error = fetcher.data?.error;

  const tabs = [
    {
      id: 'overview',
      content: 'Overview',
    },
    {
      id: 'store-info',
      content: 'Store Information',
    },
    {
      id: 'dashboard',
      content: 'Dashboard',
      url: '/app/dashboard',
    },
    {
      id: 'store-context',
      content: 'Store Context',
      url: '/app/store-context',
    },
  ];

  const billingSuccess = searchParams.get("billing") === "success";

  return (
    <Page>
      <TitleBar title="ShopAI" />
      <BlockStack gap="500">
        {billingSuccess && (
          <Banner title="Welcome to ShopAI Pro!" tone="success" onDismiss={() => {}}>
            <p>Your subscription is now active. Enjoy unlimited AI-powered customer questions!</p>
          </Banner>
        )}
        {!hasActivePayment && usage && (
          <UsageMeter
            questionsUsed={usage.questionsUsed}
            questionsLimit={50}
            summariesUsed={usage.summariesUsed}
            summariesLimit={10}
            resetDate={new Date(usage.resetDate)}
          />
        )}
        {!hasActivePayment && !usage && (
          <Banner
            title="Free Plan Active"
            tone="info"
            action={{
              content: "View Plans",
              url: "/app/pricing",
            }}
          >
            <p>
              You're using the Free Plan with 50 questions and 10 review summaries per month.
            </p>
          </Banner>
        )}
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          {selectedTab === 0 && (
            <Layout>
              {!hasActivePayment && (
                <Layout.Section>
                  <UpgradeBanner
                    title="Upgrade to Pro Plan"
                    message="Get unlimited AI questions, unlimited review summaries, and priority support. Start converting more customers today!"
                  />
                </Layout.Section>
              )}
              <Layout.Section>
                <Card>
                  <BlockStack gap="500">
                    <BlockStack gap="200">
                      <Box paddingBlockEnd="200">
                        <InlineStack gap="200" align="start">
                          <Text as="h1" variant="headingLg">
                            Welcome to ShopAI
                          </Text>
                          <Badge tone="success">v1.6.0</Badge>
                        </InlineStack>
                      </Box>
                      <Text variant="bodyLg" as="p">
                        AI-powered product assistance and review summarization for your Shopify store.
                      </Text>
                    </BlockStack>

                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        What ShopAI Does
                      </Text>
                      <List>
                        <List.Item>
                          <strong>Product Q&A:</strong> Customers can ask questions about your products and get instant AI-powered answers
                        </List.Item>
                        <List.Item>
                          <strong>Review Summarization:</strong> Automatically summarize product reviews to highlight key insights
                        </List.Item>
                        <List.Item>
                          <strong>Smart Suggestions:</strong> Generate relevant questions customers might have about products
                        </List.Item>
                        <List.Item>
                          <strong>Store Context:</strong> Use your store information to provide better customer service answers
                        </List.Item>
                      </List>
                    </BlockStack>

                    <Banner
                      title="Enhance AI Responses"
                      tone="info"
                    >
                      <Text variant="bodyMd">
                        Add your store information in the "Store Information" tab to help the AI provide more accurate answers about shipping, returns, store policies, and more!
                      </Text>
                    </Banner>

                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        Implementation Guide
                      </Text>
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        Follow these steps to add AI-powered features to your product pages:
                      </Text>

                      <BlockStack gap="400">
                        <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="300">
                            <Text variant="headingSm" as="h3">Step 1: Configure Store Information</Text>
                            <List>
                              <List.Item>
                                Click the <strong>"Store Information"</strong> tab above
                              </List.Item>
                              <List.Item>
                                Fill in your shipping policy, return policy, store hours, and contact information
                              </List.Item>
                              <List.Item>
                                This helps the AI provide accurate answers about your store policies
                              </List.Item>
                              <List.Item>
                                Click <strong>"Save Store Information"</strong> when complete
                              </List.Item>
                            </List>
                          </BlockStack>
                        </Box>

                        <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="300">
                            <Text variant="headingSm" as="h3">Step 2: Open Your Theme Editor</Text>
                            <List>
                              <List.Item>
                                In your Shopify admin, go to <strong>Online Store → Themes</strong>
                              </List.Item>
                              <List.Item>
                                On your active theme, click <strong>"Customize"</strong>
                              </List.Item>
                              <List.Item>
                                In the theme editor, navigate to a <strong>Product page</strong> using the page selector at the top
                              </List.Item>
                            </List>
                          </BlockStack>
                        </Box>

                        <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="300">
                            <Text variant="headingSm" as="h3">Step 3: Add the "Ask Me Anything" Block</Text>
                            <List>
                              <List.Item>
                                In the left sidebar, click <strong>"Add block"</strong> (or "Add section")
                              </List.Item>
                              <List.Item>
                                Search for <strong>"Ask Me Anything"</strong> and select it
                              </List.Item>
                              <List.Item>
                                Position the block where you want it on the product page (recommended: below product description)
                              </List.Item>
                              <List.Item>
                                Customize the block settings:
                                <List>
                                  <List.Item><strong>Language:</strong> Set your store's language</List.Item>
                                  <List.Item><strong>Placeholder text:</strong> Customize the input prompt</List.Item>
                                  <List.Item><strong>Colors:</strong> Match your brand colors</List.Item>
                                  <List.Item><strong>Logo:</strong> Upload your logo (optional)</List.Item>
                                </List>
                              </List.Item>
                            </List>
                          </BlockStack>
                        </Box>

                        <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="300">
                            <Text variant="headingSm" as="h3">Step 4: Add the "Review Summarizer" Block (Optional)</Text>
                            <List>
                              <List.Item>
                                Click <strong>"Add block"</strong> again
                              </List.Item>
                              <List.Item>
                                Search for <strong>"Review Summarizer"</strong> and select it
                              </List.Item>
                              <List.Item>
                                Position it near your reviews section (recommended: directly above reviews)
                              </List.Item>
                              <List.Item>
                                Customize colors and styling to match your theme
                              </List.Item>
                              <List.Item>
                                <strong>Note:</strong> This requires product reviews to be present (works with Judge.me and Shopify native reviews)
                              </List.Item>
                            </List>
                          </BlockStack>
                        </Box>

                        <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="300">
                            <Text variant="headingSm" as="h3">Step 5: Save and Test</Text>
                            <List>
                              <List.Item>
                                Click <strong>"Save"</strong> in the top right corner of the theme editor
                              </List.Item>
                              <List.Item>
                                Visit a product page on your live store
                              </List.Item>
                              <List.Item>
                                Test the "Ask Me Anything" widget by asking a question about the product
                              </List.Item>
                              <List.Item>
                                Check the <strong>"Dashboard"</strong> tab to view analytics and customer questions
                              </List.Item>
                            </List>
                          </BlockStack>
                        </Box>
                      </BlockStack>

                      <Banner tone="info">
                        <Text variant="bodyMd">
                          <strong>Pro Tip:</strong> The more detailed your store information, the better the AI responses will be. Update the Store Information tab regularly to keep answers current.
                        </Text>
                      </Banner>
                    </BlockStack>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section variant="oneThird">
                <BlockStack gap="500">
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h2" variant="headingMd">
                        Technical Details
                      </Text>
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <Text as="span" variant="bodyMd">
                            AI Model
                          </Text>
                          <Text as="span" variant="bodyMd" fontWeight="medium">
                            GPT-5 Nano
                          </Text>
                        </InlineStack>
                        <InlineStack align="space-between">
                          <Text as="span" variant="bodyMd">
                            Framework
                          </Text>
                          <Text as="span" variant="bodyMd" fontWeight="medium">
                            Remix
                          </Text>
                        </InlineStack>
                        <InlineStack align="space-between">
                          <Text as="span" variant="bodyMd">
                            Database
                          </Text>
                          <Text as="span" variant="bodyMd" fontWeight="medium">
                            PostgreSQL
                          </Text>
                        </InlineStack>
                        <InlineStack align="space-between">
                          <Text as="span" variant="bodyMd">
                            Hosting
                          </Text>
                          <Text as="span" variant="bodyMd" fontWeight="medium">
                            Fly.io
                          </Text>
                        </InlineStack>
                      </BlockStack>
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="200">
                      <Text as="h2" variant="headingMd">
                        Privacy & Security
                      </Text>
                      <List>
                        <List.Item>
                          Only product information and store details are processed
                        </List.Item>
                        <List.Item>
                          No customer data or sensitive information is shared
                        </List.Item>
                        <List.Item>
                          All AI requests are processed securely
                        </List.Item>
                        <List.Item>
                          Data is used only for generating responses
                        </List.Item>
                      </List>
                    </BlockStack>
                  </Card>

                  <Card>
                    <BlockStack gap="200">
                      <Text as="h2" variant="headingMd">
                        Need Help?
                      </Text>
                      <Text variant="bodyMd">
                        If you need assistance with ShopAI, check the{" "}
                        <Link url="https://shopify.dev/docs/apps" target="_blank" removeUnderline>
                          Shopify App documentation
                        </Link>{" "}
                        or contact support.
                      </Text>
                    </BlockStack>
                  </Card>
                </BlockStack>
              </Layout.Section>
            </Layout>
          )}

          {selectedTab === 1 && (
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="500">
                    <BlockStack gap="200">
                      <Text as="h2" variant="headingLg">
                        Store Information
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Provide information about your store to help the AI give better, more accurate answers to your customers. This information will be used when customers ask questions about shipping, returns, store policies, and general store information.
                      </Text>
                    </BlockStack>

                    {showSuccess && (
                      <Banner title="Store information saved successfully!" status="success" />
                    )}

                    {error && (
                      <Banner title="Error saving store information" status="critical">
                        <Text variant="bodyMd">{error}</Text>
                      </Banner>
                    )}

                    <BlockStack gap="400">
                      <TextField
                        label="Store Name"
                        value={formData.storeName}
                        onChange={(value) => handleInputChange('storeName', value)}
                        placeholder="Your store name"
                        helpText="The name of your store"
                      />

                      <TextField
                        label="Store Description"
                        value={formData.storeDescription}
                        onChange={(value) => handleInputChange('storeDescription', value)}
                        multiline={3}
                        placeholder="Brief description of your store and what you sell"
                        helpText="A brief overview of your store and products"
                      />

                      <TextField
                        label="Shipping Policy"
                        value={formData.shippingPolicy}
                        onChange={(value) => handleInputChange('shippingPolicy', value)}
                        multiline={4}
                        placeholder="Shipping times, costs, regions served, etc."
                        helpText="Information about shipping times, costs, and regions you serve"
                      />

                      <TextField
                        label="Return Policy"
                        value={formData.returnPolicy}
                        onChange={(value) => handleInputChange('returnPolicy', value)}
                        multiline={4}
                        placeholder="Return window, conditions, process, etc."
                        helpText="Your return and refund policy details"
                      />

                      <TextField
                        label="Store Hours"
                        value={formData.storeHours}
                        onChange={(value) => handleInputChange('storeHours', value)}
                        multiline={2}
                        placeholder="Monday-Friday: 9AM-6PM, Saturday: 10AM-4PM, etc."
                        helpText="Business hours and availability (if applicable)"
                      />

                      <TextField
                        label="Contact Information"
                        value={formData.contactInfo}
                        onChange={(value) => handleInputChange('contactInfo', value)}
                        multiline={3}
                        placeholder="Email, phone, address, etc."
                        helpText="How customers can reach you for support"
                      />

                      <TextField
                        label="Special Services"
                        value={formData.specialServices}
                        onChange={(value) => handleInputChange('specialServices', value)}
                        multiline={3}
                        placeholder="Custom orders, installation, consulting, etc."
                        helpText="Any special services you offer"
                      />

                      <TextField
                        label="About Us"
                        value={formData.aboutUs}
                        onChange={(value) => handleInputChange('aboutUs', value)}
                        multiline={4}
                        placeholder="Your story, mission, values, etc."
                        helpText="Information about your company background and values"
                      />

                      <TextField
                        label="Additional Information"
                        value={formData.additionalInfo}
                        onChange={(value) => handleInputChange('additionalInfo', value)}
                        multiline={4}
                        placeholder="Any other information that might help answer customer questions"
                        helpText="Any other relevant information for customer service"
                      />

                      <InlineStack gap="300">
                        <Button 
                          primary 
                          loading={isLoading}
                          onClick={handleSaveStoreInfo}
                        >
                          Save Store Information
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section variant="oneThird">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">
                      How This Helps
                    </Text>
                    <Text variant="bodyMd">
                      When customers use the "Ask Me Anything" feature, the AI will have access to this store information to provide more accurate and helpful answers about:
                    </Text>
                    <List>
                      <List.Item>Shipping times and costs</List.Item>
                      <List.Item>Return and refund processes</List.Item>
                      <List.Item>Store policies and procedures</List.Item>
                      <List.Item>Special services you offer</List.Item>
                      <List.Item>Contact information for support</List.Item>
                      <List.Item>General store information</List.Item>
                    </List>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingMd">
                      Tips for Better Results
                    </Text>
                    <List>
                      <List.Item>
                        <strong>Be specific:</strong> Include exact shipping times, costs, and regions
                      </List.Item>
                      <List.Item>
                        <strong>Keep it current:</strong> Update information when policies change
                      </List.Item>
                      <List.Item>
                        <strong>Be comprehensive:</strong> Include common questions customers ask
                      </List.Item>
                      <List.Item>
                        <strong>Use clear language:</strong> Write as if explaining to a customer
                      </List.Item>
                    </List>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          )}
        </Tabs>
      </BlockStack>
    </Page>
  );
}
