import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
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

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
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
  
  return { storeInfo };
};

export default function Index() {
  const app = useAppBridge();
  const { storeInfo } = useLoaderData();
  const fetcher = useFetcher();
  
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
  ];

  return (
    <Page>
      <TitleBar title="ShopAI" />
      <BlockStack gap="500">
        <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
          {selectedTab === 0 && (
            <Layout>
              <Layout.Section>
                <Card>
                  <BlockStack gap="500">
                    <BlockStack gap="200">
                      <Box paddingBlockEnd="200">
                        <InlineStack gap="200" align="start">
                          <Text as="h1" variant="headingLg">
                            Welcome to ShopAI 🤖
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
                      title="💡 Enhance AI Responses"
                      status="info"
                    >
                      <Text variant="bodyMd">
                        Add your store information in the "Store Information" tab to help the AI provide more accurate answers about shipping, returns, store policies, and more!
                      </Text>
                    </Banner>

                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        How to Use ShopAI
                      </Text>
                      <Text variant="bodyMd" as="p">
                        ShopAI adds two powerful blocks to your theme editor:
                      </Text>
                      <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="200">
                          <InlineStack gap="200">
                            <Badge>Block</Badge>
                            <Text variant="bodyMd" fontWeight="semibold">Ask Me Anything</Text>
                          </InlineStack>
                          <Text variant="bodyMd">
                            Add this block to product pages so customers can ask questions and get AI-powered answers about your products and store.
                          </Text>
                        </BlockStack>
                      </Box>
                      <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="200">
                          <InlineStack gap="200">
                            <Badge>Block</Badge>
                            <Text variant="bodyMd" fontWeight="semibold">Review Summarizer</Text>
                          </InlineStack>
                          <Text variant="bodyMd">
                            Automatically summarize product reviews to help customers quickly understand the key points.
                          </Text>
                        </BlockStack>
                      </Box>
                    </BlockStack>

                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">
                        Getting Started
                      </Text>
                      <List type="number">
                        <List.Item>
                          <strong>Add Store Information:</strong> Fill out the "Store Information" tab with your policies and details
                        </List.Item>
                        <List.Item>
                          Go to your theme editor: <strong>Online Store → Themes → Customize</strong>
                        </List.Item>
                        <List.Item>
                          Navigate to a product page template
                        </List.Item>
                        <List.Item>
                          Click <strong>"Add block"</strong> and look for the ShopAI blocks
                        </List.Item>
                        <List.Item>
                          Add either "Ask Me Anything" or "Review Summarizer" (or both!)
                        </List.Item>
                        <List.Item>
                          Save your theme and test it on your live store
                        </List.Item>
                      </List>
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
                            GPT-4o Mini
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
