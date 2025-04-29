# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2024-06-03

### Added
- Integrated Judge.me review metafields into product context:
  - Added average rating and review count data to the AI context.
  - Implemented conditional formatting to handle products with and without reviews.
  - Used the standard Shopify metafields from Judge.me (`reviews.rating` and `reviews.rating_count`).

## [Unreleased] - 2024-06-01

### Added
- Integrated OpenAI API for product Q&A:
  - Added OpenAI Node.js package (`openai`).
  - Implemented backend API route (`/api/resource-openai`) using Remix resource routes.
  - Configured Shopify App Proxy to securely connect frontend to backend API.
- Added basic input validation and safeguards:
  - Frontend `maxlength` attribute on search input.
  - Server-side length validation for question and product context.
  - Configured hard spending limits in OpenAI account (manual step).
- "Powered by ShopAI" attribution text to the Ask Me Anything block response area.

### Changed
- **OpenAI Integration:**
  - Refined OpenAI prompt for clarity, context-focus, and specific fallback message.
  - Lowered OpenAI API `temperature` setting to `0.3` for more factual answers.
  - Improved product context gathering in Liquid (`ask-me-anything.liquid`):
    - Included product price, tags, and variant details (title, price, availability).
- **\"Ask Me Anything\" UI:**
  - Applied styling refinements inspired by reference design:
    - Adjusted padding, margins, and shadow for search bar.
    - Increased font size and line height for response area.
    - Ensured consistent font usage.
  - Updated Ask Me Anything block styling for attribution text (position, size, color).
  - Refined JavaScript error handling in Ask Me Anything block to better report backend/proxy errors and prevent console clutter.
- **Internal:** Renamed backend API route from `resource-openai.tsx` to `api.resource-openai.tsx` to align with App Proxy configuration.

### Fixed
- **API Routing:** Resolved 404 errors when calling backend API from theme extension by implementing Shopify App Proxy.
- **Configuration:** Fixed Liquid schema validation error by removing unnecessary empty `stylesheet` key from `ask-me-anything.liquid`.
- **Development:** Addressed previous development environment issues:
  - Resolved `EADDRINUSE` port conflicts.
  - Handled Shopify Partners API 500 errors (related to authentication/CLI issues).
  - Corrected directory context for running `shopify app dev`.
  - Addressed Shopify rate limiting issues during troubleshooting.
  - Removed excessive console logging from input event listeners in `ask-me-anything.js`.
- **Theme Editor:** Resolved issue where the extension section wasn't appearing by moving block file out of subdirectory and adding `extension_points` to `shopify.extension.toml`.
- **Styling:** Fixed various search bar styling issues, including focus state inconsistencies.
- **Backend Server:** Resolved backend server startup issue causing 500 errors on App Proxy requests:
  - Identified `EADDRINUSE` error for port 9293 preventing `shopify app dev` from starting correctly.
  - Used `lsof` to find and `kill` the conflicting process (a leftover node process).
  - Successfully restarted the development server after clearing the port conflict.

### Removed
- Removed default star rating component provided by Shopify CLI template.

### Security
- Implemented secure storage of OpenAI API key using environment variables.
- Ensured `.env` file is properly gitignored.

## [Unreleased] - 2024-04-01

### Added
- Initial Shopify App and Theme App Extension setup using Shopify CLI.
- Configured Node.js and npm environment.
- Established connection to development store (`productwisetest.myshopify.com`).
- Created this changelog file.

### Changed
- Removed default star rating component
- Added new "Ask Me Anything" search component
  - Created basic UI matching design
  - Added input handling and focus effects
  - Prepared structure for search functionality
- Refined "Ask Me Anything" search component UI:
  - Increased height of the search bar.
  - Added gradient border effect.
  - Replaced emoji icon with `✦` symbol and applied gradient.
  - Applied gradient to placeholder text.
  - Styled search bar into a pill shape.
  - Ensured consistent appearance during focus state.
  - Centered placeholder text vertically.

### Fixed
- Resolved issue where the extension section wasn't appearing in the Theme Editor by moving block file out of subdirectory and adding `extension_points` to `shopify.extension.toml`.

## [Unreleased] - 2024-06-04

### Changed
- **Fly.io Hosting:**
  - Updated `fly.toml` to set `min_machines_running = 1`, preventing cold starts and improving response times for the app on Fly.io.

- **OpenAI API Integration:**
  - Refactored backend API route (`api.resource-openai.tsx`) to use the Vercel AI SDK v4 streaming API (`streamText` with `openai` provider), enabling streamed responses from OpenAI.
  - Fixed all import and usage issues with the latest AI SDK and OpenAI provider, ensuring compatibility and stability.
  - Switched to using the global `Response` object for streaming, improving Remix compatibility.

- **Frontend Streaming Support:**
  - Updated `ask-me-anything.js` to handle streamed responses from the backend, incrementally displaying AI answers as they arrive for a faster, more interactive user experience.
  - Improved error handling for streamed and non-streamed responses.

- **Prompt Engineering:**
  - Refined the OpenAI prompt to:
    - Avoid listing individual reviews verbatim.
    - Summarize overall sentiment, highlight recurring themes, and mention consensus or disagreements in reviews.
    - Maintain a helpful, friendly, and concise tone.

### Fixed
- Resolved server crashes and 500 errors caused by incorrect AI SDK imports and usage.
- Fixed repeated VM restarts on Fly.io by correcting backend streaming implementation and dependency setup.

### Removed
- Removed default star rating component provided by Shopify CLI template.

### Security
- Implemented secure storage of OpenAI API key using environment variables.
- Ensured `.env` file is properly gitignored.

## [Unreleased] - 2024-04-01

### Added
- Initial Shopify App and Theme App Extension setup using Shopify CLI.
- Configured Node.js and npm environment.
- Established connection to development store (`productwisetest.myshopify.com`).
- Created this changelog file.

### Changed
- Removed default star rating component
- Added new "Ask Me Anything" search component
  - Created basic UI matching design
  - Added input handling and focus effects
  - Prepared structure for search functionality
- Refined "Ask Me Anything" search component UI:
  - Increased height of the search bar.
  - Added gradient border effect.
  - Replaced emoji icon with `✦` symbol and applied gradient.
  - Applied gradient to placeholder text.
  - Styled search bar into a pill shape.
  - Ensured consistent appearance during focus state.
  - Centered placeholder text vertically.

### Fixed
- Resolved issue where the extension section wasn't appearing in the Theme Editor by moving block file out of subdirectory and adding `extension_points` to `shopify.extension.toml`.

## [Unreleased] - 2024-06-04

### Fixed
- Improved Judge.me review scraping in Ask Me Anything widget:
  - Added robust waiting logic using MutationObserver and increased wait time (up to 20s) to capture reviews loaded asynchronously or after scroll.
  - Enhanced logging for easier debugging and confirmation of review capture.
  - Ensured up to 5 reviews are reliably extracted and sent to the AI context.

## [Unreleased] - 2024-06-05

### Added
- **AI Review Summary Block:**
  - Created a new Shopify block (`review-summary.liquid`) to display an AI-generated summary of product reviews.
  - Implemented review scraping logic (`review-summary.js`) similar to the Ask Me Anything block, which triggers the summary generation.
  - Added a dedicated backend resource route (`api.resource-review-summary.tsx`) to handle summarization requests using OpenAI (`gpt-4o-mini`) via the Vercel AI SDK (`streamText`).
  - Designed the block to be hidden if no reviews are found on the page.
  - Included styling for the block header (title and icon) with a gradient effect, and a styled response area with loading/error states.

### Changed
- Minified `review-summary.js` using `terser` to `review-summary.min.js` to resolve linter file size warnings.
- Updated `review-summary.liquid` schema to reference the minified JavaScript file.
- Increased padding in the Review Summary block's response area for better text spacing.
- Refined the OpenAI prompt for the Review Summary block to request a more concise (2-3 sentence) summary.

### Fixed
- Resolved persistent error (`3:"An error occurred."`) in Review Summary block by switching from streaming (`ai` SDK) to non-streaming (`openai` SDK) API calls for the backend route (`resource-review-summary.tsx`). Root cause appeared to be an issue with the AI SDK's stream handling returning the error text within the stream itself.
- Updated frontend (`review-summary.js`) to handle the new JSON response format from the non-streaming backend endpoint.

### Removed
- Removed default star rating component provided by Shopify CLI template.

### Security
- Implemented secure storage of OpenAI API key using environment variables.
- Ensured `.env` file is properly gitignored.

## [Unreleased] - 2024-06-05

### Added
- Updated AskMeAnything component styles for better alignment and visual appeal.
- Added basic loading and error states to AskMeAnything component.
- Implemented fetching and displaying AI-generated answers in AskMeAnything.
- Integrated review scraping (DOM-based) into AskMeAnything context.
- Added language selection to AskMeAnything and passed it to the backend.
- Refactored AskMeAnything JS for robustness using Shopify section events.
- Added Review Summary block with basic structure and styling.
- Implemented AI review summary fetching and display logic.
- Refined styling for Review Summary block (loading, error, attribution).
- Switched AskMeAnything review scraping from DOM to Judge.me API.

### Changed
- Minified `review-summary.js` using `terser` to `review-summary.min.js` to resolve linter file size warnings.
- Updated `review-summary.liquid` schema to reference the minified JavaScript file.

### Fixed
- Resolved Shopify linter error "The schema does not exist" in `review-summary.liquid` by removing the unnecessary `"target": "section"` property from the schema definition.
- Reduced source file size of `review-summary.js` by commenting out non-essential `console.log` statements to address linter file size warnings.

## [Unreleased] - 2024-06-06

### Changed
- Improved Review Summary block UI/UX:
  - Increased padding and max width of the summary response area for better readability and whitespace.
  - Further increased bottom padding to ensure the attribution text ("Powered by ShopAI") never overlaps with the summary, even for long summaries or large text sizes.
  - Moved attribution lower and increased its background and padding for clarity.
- Re-minified `review-summary.js` to `review-summary.min.js` to ensure latest logic is deployed. 