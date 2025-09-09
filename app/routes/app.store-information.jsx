import { json } from "@remix-run/node";
import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  TextField,
  Button,
  Banner,
  InlineStack,
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  try {
    console.log("🔍 Loading store info for shop:", session.shop);
    const storeInfo = await prisma.storeInformation.findUnique({
      where: { shop: session.shop }
    });
    console.log("📊 Store info found:", storeInfo ? "Yes" : "No", storeInfo ? `(${Object.keys(storeInfo).length} fields)` : "");
    
    return json({ storeInfo });
  } catch (error) {
    console.error("❌ Error loading store information:", error);
    return json({ storeInfo: null, error: "Failed to load store information" });
  }
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let requestData;
  try {
    requestData = await request.json();
  } catch (e) {
    console.error("Failed to parse request JSON:", e);
    return json({ error: "Invalid request format" }, { status: 400 });
  }

  const {
    storeName,
    storeDescription,
    shippingPolicy,
    returnPolicy,
    storeHours,
    contactInfo,
    specialServices,
    aboutUs,
    additionalInfo
  } = requestData;

  try {
    console.log("💾 Saving store info for shop:", session.shop);
    console.log("📝 Data being saved:", { storeName, storeDescription: storeDescription?.length || 0 });
    
    const storeInfo = await prisma.storeInformation.upsert({
      where: { shop: session.shop },
      update: {
        storeName,
        storeDescription,
        shippingPolicy,
        returnPolicy,
        storeHours,
        contactInfo,
        specialServices,
        aboutUs,
        additionalInfo,
        updatedAt: new Date()
      },
      create: {
        shop: session.shop,
        storeName,
        storeDescription,
        shippingPolicy,
        returnPolicy,
        storeHours,
        contactInfo,
        specialServices,
        aboutUs,
        additionalInfo
      }
    });

    console.log("✅ Store info saved successfully for shop:", session.shop);
    return json({ success: true, storeInfo });
  } catch (error) {
    console.error("❌ Error saving store information:", error);
    return json({ error: "Failed to save store information" }, { status: 500 });
  }
};

export default function StoreInformation() {
  const { storeInfo } = useLoaderData();
  const fetcher = useFetcher();
  
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
      encType: "application/json"
    });
  };

  const isLoading = fetcher.state === "submitting";
  const showSuccess = fetcher.data?.success;
  const error = fetcher.data?.error;

  return (
    <Page>
      <TitleBar title="Store Information" />
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
    </Page>
  );
} 