# ShopAI - AI-Powered Product Q&A for Shopify

ShopAI is a Shopify Theme App Extension that adds an "Ask Me Anything" search bar to your product pages. Customers can ask questions about the product, and the app uses the OpenAI API to provide answers based on the product's description and details.

<img width="593" alt="image" src="https://github.com/user-attachments/assets/6adb16d2-efe4-4e37-ad92-2d62862a7887" />


## Features

*   **"Ask Me Anything" Search Bar:** Allows customers to ask natural language questions about products directly on the product page.
*   **OpenAI Integration:** Leverages OpenAI's language models to understand questions and generate relevant answers based on product context.
*   **Seamless Theme Integration:** Adds a new section available in the Shopify Theme Editor for easy placement and configuration.
*   **Customizable UI:** Modern search bar design with gradient effects, easily styleable via Liquid and CSS.

## Technology Stack

*   **Frontend:** Remix, React, TypeScript, Tailwind CSS
*   **Backend:** Remix (Resource Routes for API endpoint)
*   **Shopify:** Shopify CLI, Theme App Extensions, Liquid
*   **AI:** OpenAI API (gpt-3.5-turbo)
*   **Database:** Prisma with SQLite (for session storage)


## Usage

1.  **Add the Section:** In your Shopify development store's Theme Editor, navigate to a product page. Click "Add section" and search for "Ask Me Anything" (or the name configured in `shopify.extension.toml`). Add the section to your desired location.
2.  **Ask Questions:** View the product page on your storefront. Use the "Ask Me Anything" search bar to ask questions about the product. The response from OpenAI, based on the product details, will appear below the search bar.

## Troubleshooting

*   **Extension Not Appearing:** Ensure `extension_points = ["section"]` is present in `shop-ai/extensions/shop-ai/shopify.extension.toml`. Make sure the block file (`ask-me-anything.liquid`) is directly inside the `blocks` directory. Restart `shopify app dev` and hard-refresh the Theme Editor.
*   **OpenAI API Key Error:** Double-check that the `OPENAI_API_KEY` is correctly set in the `shop-ai/.env` file and that the backend route (`resource-openai.tsx`) is loading it correctly.
*   **500 Internal Server Error / Rate Limiting:** These errors from Shopify's API during `shopify app dev` might be temporary Shopify issues or due to making too many requests. Try waiting, restarting the dev server, re-authenticating (`shopify auth logout` then run `shopify app dev` again), or updating the Shopify CLI (`npm update -g @shopify/cli @shopify/theme`). Check `https://www.shopifystatus.com/`.
*   **404 Errors for API Route:** Ensure the API route file (`shop-ai/app/routes/resource-openai.tsx`) exists and is correctly configured as a resource route (no default export). Check the `fetch` URL in the frontend JavaScript (`ask-me-anything.js`).

## Changelog

See [changelog.md](changelog.md) for a detailed history of changes. 
