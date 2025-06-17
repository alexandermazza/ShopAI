import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";

export const meta = () => {
  return [
    { title: "ShopAI App" },
    { name: "viewport", content: "width=device-width,initial-scale=1" },
  ];
};

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  
  return {
    shop
  };
};

export const headers = ({ loaderData }) => {
  const shop = loaderData?.shop;
  
  // Dynamic frame-ancestors based on shop parameter
  let frameAncestors = "'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com";
  if (shop) {
    frameAncestors = `'self' https://${shop} https://admin.shopify.com`;
  }
  
  return {
    "Content-Security-Policy": `frame-ancestors ${frameAncestors}`,
    "X-Frame-Options": "SAMEORIGIN"
  };
};

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {/* Allow embedding in Shopify iframe */}
        <meta httpEquiv="Content-Security-Policy" content="frame-ancestors 'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        {/* Add App Bridge script from Shopify's CDN for embedded app compliance */}
        <script
          src="https://cdn.shopify.com/shopifycloud/app-bridge/app-bridge.js"
          defer
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
