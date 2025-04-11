# Changelog

All notable changes to this project will be documented in this file.

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