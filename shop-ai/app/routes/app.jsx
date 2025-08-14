import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
  // Ensure App Bridge script is loaded from Shopify's CDN for embedded app compliance
  { rel: "preload", href: "https://cdn.shopify.com/shopifycloud/app-bridge/app-bridge.js", as: "script" }
];

export const loader = async ({ request }) => {
  console.log("📝 App route loader starting", { 
    url: request.url,
    userAgent: request.headers.get('user-agent'),
    referer: request.headers.get('referer')
  });

  try {
    const { session, admin } = await authenticate.admin(request);
    
    console.log("✅ App route: Authentication successful", { 
      shop: session.shop,
      scope: session.scope,
      isOnline: session.isOnline,
      hasAdmin: !!admin
    });

    return json({
      shopOrigin: `https://${session.shop}`,
      apiKey: process.env.SHOPIFY_API_KEY || "",
      shop: session.shop
    });
  } catch (error) {
    console.error("❌ App route: Authentication failed", {
      message: error.message,
      name: error.name,
      url: request.url,
      stack: error.stack?.substring(0, 500) // Truncate stack trace for logs
    });
    
    // Check if this is a session not found error
    if (error.message?.includes('session not found') || 
        error.message?.includes('Invalid session') ||
        error.message?.includes('shop parameter is required')) {
      
      console.log("📝 App route: Redirecting to auth due to session error");
      
      // Extract shop from URL if available
      const url = new URL(request.url);
      const shop = url.searchParams.get('shop') || url.hostname.split('.')[0];
      
      throw new Response(null, {
        status: 302,
        headers: {
          Location: `/auth${shop ? `?shop=${shop}` : ''}`
        }
      });
    }
    
    throw error;
  }
};

export default function App() {
  const { shopOrigin, apiKey } = useLoaderData();

  return (
    <>
      {/* Ensure App Bridge script is loaded for embedded app compliance */}
      <script
        src="https://cdn.shopify.com/shopifycloud/app-bridge/app-bridge.js"
        async
      />
      <AppProvider isEmbeddedApp apiKey={apiKey} shopOrigin={shopOrigin}>
        <NavMenu>
          <Link to="/app" rel="home">
            Home
          </Link>
          <Link to="/app/store-information">Store Information</Link>
          <Link to="/app/store-context">Store Context</Link>
          <Link to="/app/dashboard">Dashboard</Link>
          <Link to="/app/plan-setup">Referral Code</Link>
        </NavMenu>
        <Outlet />
      </AppProvider>
    </>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();
  console.error("❌ App route ErrorBoundary triggered:", error);
  
  return boundary.error(error);
}

export const headers = ({ loaderData }) => {
  const shop = loaderData?.shop;
  console.log("📝 App route headers function called for shop:", shop);
  
  // Dynamic frame-ancestors based on authenticated shop
  let frameAncestors = "'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com";
  if (shop) {
    frameAncestors = `'self' https://${shop} https://admin.shopify.com`;
  }
  
  return {
    ...boundary.headers({ loaderData }),
    "Content-Security-Policy": `frame-ancestors ${frameAncestors}`,
    "X-Frame-Options": "SAMEORIGIN"
  };
};
