import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  try {
    console.log("📝 App route loader: Authentication attempt started", { url: request.url });
    await authenticate.admin(request);
    console.log("✅ App route loader: Authentication successful");
    
    const apiKey = process.env.SHOPIFY_API_KEY || "";
    console.log("📝 App route loader: API key available:", !!apiKey);
    
    return { apiKey };
  } catch (error) {
    console.error("❌ App route loader: Authentication error", error);
    throw error;
  }
};

export default function App() {
  const { apiKey } = useLoaderData();
  console.log("📝 App component: Rendering with API key:", !!apiKey);

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/additional">Additional page</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  console.error("❌ App route error boundary triggered");
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  console.log("📝 App route headers function called");
  return {
    ...boundary.headers(headersArgs),
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy": "frame-ancestors 'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com"
  };
};
