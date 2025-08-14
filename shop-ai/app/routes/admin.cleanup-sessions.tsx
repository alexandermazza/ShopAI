import { json, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { Page, Card, FormLayout, TextField, Button, Banner } from "@shopify/polaris";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

export const loader: LoaderFunction = async ({ request }) => {
  // Basic security check - only allow access with proper admin token
  const url = new URL(request.url);
  const adminToken = url.searchParams.get('admin_token');
  
  if (adminToken !== process.env.ADMIN_CLEANUP_TOKEN) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return json({ message: "Session cleanup tool ready" });
};

export const action: ActionFunction = async ({ request }) => {
  try {
    const formData = await request.formData();
    const shopDomain = formData.get('shop') as string;
    const adminToken = formData.get('admin_token') as string;
    const action = formData.get('action') as string;
    
    // Security check
    if (adminToken !== process.env.ADMIN_CLEANUP_TOKEN) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!shopDomain) {
      return json({ error: "Shop domain is required" }, { status: 400 });
    }

    if (action === 'cleanup') {
      // Delete sessions for the shop
      const deletedSessions = await db.session.deleteMany({
        where: { shop: shopDomain }
      });

      // Delete store information
      const deletedStoreInfo = await db.storeInformation.deleteMany({
        where: { shop: shopDomain }
      });

      return json({
        success: true,
        message: `Cleanup completed for ${shopDomain}`,
        details: {
          deletedSessions: deletedSessions.count,
          deletedStoreInfo: deletedStoreInfo.count
        }
      });
    }

    if (action === 'list') {
      // List sessions for the shop
      const sessions = await db.session.findMany({
        where: { shop: shopDomain },
        select: {
          id: true,
          shop: true,
          isOnline: true,
          scope: true,
          expires: true
        }
      });

      return json({
        success: true,
        sessions,
        count: sessions.length
      });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Session cleanup error:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
};

export default function SessionCleanup() {
  const actionData = useActionData<any>();

  return (
    <Page title="Session Cleanup Tool">
      <Card>
        <div style={{ padding: '16px' }}>
          {actionData?.error && (
            <Banner tone="critical" title="Error">
              {actionData.error}
            </Banner>
          )}
          
          {actionData?.success && (
            <Banner tone="success" title="Success">
              {actionData.message}
              {actionData.details && (
                <ul>
                  <li>Sessions deleted: {actionData.details.deletedSessions}</li>
                  <li>Store info deleted: {actionData.details.deletedStoreInfo}</li>
                </ul>
              )}
              {actionData.sessions && (
                <div>
                  <p>Found {actionData.count} sessions:</p>
                  <pre>{JSON.stringify(actionData.sessions, null, 2)}</pre>
                </div>
              )}
            </Banner>
          )}

          <Form method="post">
            <FormLayout>
              <TextField
                label="Shop Domain"
                name="shop"
                placeholder="example.myshopify.com"
                helpText="Enter the shop domain to clean up sessions for"
                autoComplete="off"
              />
              
              <TextField
                label="Admin Token"
                name="admin_token"
                type="password"
                placeholder="Enter admin cleanup token"
                helpText="Security token required for cleanup operations"
                autoComplete="off"
              />
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" name="action" value="list" style={{ 
                  padding: '8px 16px', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  background: '#fff',
                  cursor: 'pointer'
                }}>
                  List Sessions
                </button>
                <button type="submit" name="action" value="cleanup" style={{ 
                  padding: '8px 16px', 
                  border: '1px solid #d72c0d', 
                  borderRadius: '4px',
                  background: '#d72c0d',
                  color: 'white',
                  cursor: 'pointer'
                }}>
                  Cleanup Sessions
                </button>
              </div>
            </FormLayout>
          </Form>
        </div>
      </Card>
    </Page>
  );
} 