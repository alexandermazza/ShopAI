import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

export const meta = () => {
  return [
    { title: "ShopAI App" },
    { name: "viewport", content: "width=device-width,initial-scale=1" },
  ];
};

export const headers = () => {
  return {
    "Content-Security-Policy": "frame-ancestors 'self' https://*.shopify.com https://*.myshopify.com https://admin.shopify.com",
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
