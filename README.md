# ShopAI - AI-Powered Product Features for Shopify

ShopAI is a Shopify Theme App Extension that adds AI-powered features to your product pages, including an "Ask Me Anything" search bar and an AI-generated Review Summary.

Customers can ask questions about the product, and the app uses the OpenAI API to provide answers based on the product's description and details. It can also analyze customer reviews to provide a concise summary of feedback.

<img width="593" alt="image" src="https://github.com/user-attachments/assets/6adb16d2-efe4-4e37-ad92-2d62862a7887" />


## Features

*   **"Ask Me Anything" Search Bar:** Allows customers to ask natural language questions about products directly on the product page.
*   **AI Review Summary:** Automatically scrapes product reviews from the page and displays an AI-generated summary highlighting key customer feedback.
*   **OpenAI Integration:** Leverages OpenAI's language models (e.g., `gpt-4o-mini`) to understand questions, summarize reviews, and generate relevant content based on product context.
*   **Seamless Theme Integration:** Adds new sections available in the Shopify Theme Editor for easy placement and configuration ("Ask Me Anything", "AI Review Summary").
*   **Customizable UI:** Modern design with gradient effects, easily styleable via Liquid and CSS.

## Technology Stack

*   **Frontend:** Remix, React, TypeScript, Tailwind CSS (via Liquid `<style>` tags), Vanilla JS (`ask-me-anything.js`, `review-summary.js`)
*   **Backend:** Remix (Resource Routes for API endpoints: `api.resource-openai.tsx`, `api.resource-review-summary.tsx`)
*   **Shopify:** Shopify CLI, Theme App Extensions, Liquid
*   **AI:** OpenAI API (`gpt-4o-mini` via Vercel AI SDK `streamText`)
*   **Build Tools:** Terser (for JS minification)


## Usage

1.  **Add Blocks:** In your Shopify development store's Theme Editor, navigate to a product page. Click "Add section" or "Add block" (depending on your theme structure) and search for "Ask Me Anything" or "AI Review Summary". Add the desired blocks to your page.
2.  **Ask Questions:** Use the "Ask Me Anything" search bar to ask questions about the product.
3.  **View Summary:** The "AI Review Summary" block will automatically attempt to scrape reviews and display a summary if reviews are found.

## Troubleshooting

*   **Extension Blocks Not Appearing:** Ensure the block files (`ask-me-anything.liquid`, `review-summary.liquid`) are directly inside the `blocks` directory. Check the Shopify CLI output for any build errors. Restart `shopify app dev` and hard-refresh the Theme Editor.
*   **AI Review Summary Not Appearing:** This block hides itself if no review content (e.g., from Judge.me, Shopify Product Reviews) can be scraped from the page. Check the browser's developer console for errors from `review-summary.js`.
*   **OpenAI API Key Error:** Double-check that the `OPENAI_API_KEY` is correctly set in the `shop-ai/.env` file and that the backend routes are loading it correctly.
*   **500 Internal Server Error / Rate Limiting:** These errors from Shopify's API during `shopify app dev` might be temporary Shopify issues or due to making too many requests. Try waiting, restarting the dev server, re-authenticating (`shopify auth logout` then run `shopify app dev` again), or updating the Shopify CLI (`npm update -g @shopify/cli @shopify/theme`). Check `https://www.shopifystatus.com/`.
*   **404 Errors for API Routes:** Ensure the API route files (`shop-ai/app/routes/api.resource-openai.tsx`, `shop-ai/app/routes/api.resource-review-summary.tsx`) exist and are correctly configured as resource routes (no default export). Check the `fetch` URLs in the frontend JavaScript (`ask-me-anything.js`, `review-summary.js`).

## Changelog

See [changelog.md](changelog.md) for a detailed history of changes. 
