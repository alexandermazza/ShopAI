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
  try {
    console.log("📝 App route loader: Authentication attempt started", { url: request.url });
    const { session } = await authenticate.admin(request);
    console.log("✅ App route loader: Authentication successful", { shop: session.shop });
    
    const apiKey = process.env.SHOPIFY_API_KEY || "";
    console.log("📝 App route loader: API key available:", !!apiKey);
    
    return { 
      apiKey,
      shop: session.shop
    };
  } catch (error) {
    console.error("❌ App route loader: Authentication error", error);
    throw error;
  }
};

export default function App() {
  const { apiKey } = useLoaderData();
  console.log("📝 App component: Rendering with API key:", !!apiKey);

  return (
    <>
      {/* Ensure App Bridge script is loaded for embedded app compliance */}
      <script
        src="https://cdn.shopify.com/shopifycloud/app-bridge/app-bridge.js"
        async
      />
      <AppProvider isEmbeddedApp apiKey={apiKey}>
        <NavMenu>
          <Link to="/app" rel="home">
            Home
          </Link>
          <Link to="/app/additional">Additional page</Link>
        </NavMenu>
        <Outlet />
      </AppProvider>
    </>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  console.error("❌ App route error boundary triggered");
  return boundary.error(useRouteError());
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
