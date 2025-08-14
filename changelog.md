### 2.1.0 - 2025-08-07
- Feature: Integrated `gpt-5-mini-2025-08-07` across the application for enhanced AI capabilities, replacing older models.
- Chore: Refactored OpenAI API calls to standardize on the new `gpt-5-mini-2025-08-07` model.

# 1.8.0 (Latest)

## Major Cost Optimization: GPT-5 Nano Upgrade - January 2025
- **🚀 MASSIVE COST SAVINGS**: Upgraded all AI models to GPT-5 Nano ($0.05 input, $0.40 output per million tokens)
- **🎯 SIMPLIFIED ARCHITECTURE**: Single multimodal model replaces complex text/vision model selection logic
- **⚡ ENHANCED CAPABILITIES**: GPT-5 Nano handles both text and image analysis with 400,000 token context window
- **💰 COST REDUCTION**: Dramatically reduced API costs while maintaining or improving quality
- **🔧 MODEL CONSOLIDATION**: 
  - Replaced GPT-4.1 nano (text-only operations)
  - Replaced GPT-4o/GPT-4o-mini (vision operations)
  - Unified all routes to use single GPT-5 Nano model
- **📈 OPTIMIZED ROUTES**: Updated ask-openai.tsx, resource-openai.tsx, api.resource-openai.tsx, resource-review-summary.tsx, and app.setup-assistant.tsx
- **🎨 SIMPLIFIED LOGIC**: Removed complex conditional vision/text model selection since GPT-5 Nano is multimodal
- **🔧 COMPATIBILITY FIXES**: 
  - Updated model name to correct `gpt-5-nano`
  - Changed `max_tokens` to `max_completion_tokens` for GPT-5 compatibility
  - Removed custom `temperature` parameters (GPT-5 Nano only supports default temperature of 1)
  - Fixed API parameter compatibility issues
- **⚙️ FUTURE-PROOF**: Positioned for continued cost optimization with latest OpenAI technology

# 1.7.1

## Page View Tracking Fix & Chart Improvements - August 2025
- **FIXED PAGE VIEW TRACKING**: Created proper app proxy routes for page view tracking API endpoint
- **APP PROXY ROUTES**: Added `apps.proxy.api.page-view-tracking.tsx` route to handle Shopify app proxy requests
- **DASHBOARD ANALYTICS**: Page view tracking now working correctly, enabling dashboard graph population
- **ROUTE STRUCTURE**: Fixed routing to support `/apps/proxy/` prefix required by Shopify app proxy
- **DATABASE**: Added migration to create `ProductPageView` table with `(shop, viewedAt)` index
- **IMPROVED DATE FORMATTING**: Chart labels and tooltips now display readable dates (e.g., "Aug 6 2025" instead of "2025-08-06")
- **ENHANCED TOOLTIPS**: Custom tooltip formatting for both Questions and Page Views charts with proper labeling
- **CHART STYLING**: Updated chart backgrounds to clean white and axis text to black for better readability
- **DEPLOYMENT**: Successfully deployed tracking fix to production environment

# 1.7.0

## Referral Tracking System - January 2025
- **REFERRAL SYSTEM**: Simplified plan system to focus on referral code capture and attribution
- **SHOPIFY PLAN INTEGRATION**: Updated to use actual Shopify plan names (e.g., "Free Plan", "Pro Plan") instead of generic ones
- **REFERRAL CODE PAGE**: Dedicated "Referral Code" page for merchants to submit referral attribution
- **DASHBOARD INTEGRATION**: "Current Plan" card shows actual plan name, usage, and referral status
- **ADMIN TOOLS**: Referral payout management page for tracking stores needing payouts
- **DATABASE SCHEMA**: Extended StoreInformation model with referral tracking fields
- **USAGE TRACKING**: Question count tracking without limits (unlimited until usage-based pricing implemented)
- **NAVIGATION**: Added "Referral Code" link to navigation and "Add Referral Code" button in dashboard
- **FUTURE-READY**: Foundation prepared for usage-based pricing when Shopify billing integration is added

# 1.6.9

## Dashboard UI Overhaul & Fixes - January 2025
- **BEAUTIFUL POLARIS DESIGN**: Completely rebuilt dashboard using Shopify's official Polaris design system
- **NATIVE SHOPIFY LOOK**: Dashboard now perfectly matches Shopify admin interface with professional styling
- **FIXED ALL STYLING ISSUES**: Replaced non-working Tailwind CSS with properly functioning Polaris components
- **CHART DEPENDENCIES**: Properly installed and configured chart.js and react-chartjs-2 libraries
- **POLARIS COMPONENTS**: Used Cards, DataTable, ButtonGroup, TextField, and other native Shopify components
- **ENHANCED UX**: Added proper empty states, loading indicators, and responsive design
- **TYPESCRIPT FIXES**: Resolved all linter errors and type annotations
- **PROFESSIONAL LAYOUT**: Clean, organized layout with proper spacing and visual hierarchy

# 1.6.8

## Build & Database Fixes - January 2025
- **PRISMA IMPORT FIX**: Added named export for prisma in db.server.js to resolve build errors in webhook files
- **BUILD SUCCESS**: Fixed compilation errors for proper deployment

# 1.6.7

## Consistent High-Quality Vision Analysis - January 2025
- **QUALITY OVER COST**: Removed hit-or-miss image quality detection in favor of consistent user experience
- **Always High Detail**: Now always uses "high" detail for image analysis when vision is triggered for reliable text reading
- **Simplified Logic**: Removed complex keyword-based quality detection that was causing inconsistent results
- **Better Nutrition Reading**: Significantly improved ability to read nutrition facts, ingredients, and small text on packaging
- **Increased Image Limit**: Bumped max images from 3 back to 5 for more comprehensive product analysis
- **Enhanced Prompts**: Added explicit instructions for AI to read visible information rather than giving generic responses

# 1.6.6

## AI Cost Optimization & Smart Vision Detection - January 2025
- **MAJOR OPTIMIZATION**: Implemented intelligent vision detection to reduce GPT-4o usage by 70-80%
- **Smart Model Selection**: Uses GPT-4o-mini for vision analysis and GPT-4.1 Nano for text-only questions
- **Vision Keywords**: Detects questions about color, size, nutrition, ingredients, specifications, care instructions
- **Image Detail Optimization**: Changed from "high" to "low" detail by default, saves ~50% on image processing
- **High Detail Triggers**: Only uses expensive "high" detail for nutrition labels, specifications, and text reading
- **Smart Image Processing**: Still captures 5 product images but intelligently sends only 3 to AI for 40% cost reduction
- **Token Optimization**: Reduced max_tokens across all endpoints (answers: 1200→800, suggestions: 800→400)
- **Suggested Questions**: More conservative vision usage - only for products with nutritional/spec context
- **GPT-4.1 Nano Integration**: Switched from GPT-4o-mini to GPT-4.1 Nano for 33% additional savings + 8x larger context
- **Cost Impact**: Combined optimizations reduce API costs by an estimated 70-80% while maintaining quality
- **Performance**: Faster responses for text-only questions using GPT-4.1 Nano (OpenAI's fastest model)
- **Technical**: Enhanced logging to track vision usage and decision-making for monitoring

# 1.6.5 (Latest)

## Mobile Responsiveness & Loading Experience Improvements - January 2025
- **ENHANCEMENT**: Improved mobile display of Ask Me Anything search bar to prevent text cutoff
- **NEW FEATURE**: Added "Thinking..." shimmer loading animation while AI processes requests
- **Fix**: Reduced font sizes, padding, and button sizes for better mobile UX
- **Responsive Design**: Implemented mobile-first CSS with media queries that scale up for larger screens
- **Loading Experience**: Enhanced user feedback during AI processing with animated shimmer effect
- **Technical Changes**:
  - Reduced input font size from 1.6rem to 1.4rem on mobile (scales to 1.6rem on desktop)
  - Decreased input height from 4.5rem to 4rem on mobile
  - Optimized padding and margins for smaller screens
  - Adjusted clear button size and positioning for mobile
  - Added responsive breakpoint at 768px for desktop scaling
  - Implemented "Thinking..." text with CSS shimmer animation during loading
  - Added fallback pulse animation for browsers without background-clip support
- **User Experience**: Search placeholder text and buttons now display properly on mobile devices
- **Loading UX**: Users now see visual feedback ("Thinking..." with shimmer) instead of blank response area
- **Accessibility**: Maintained proper touch targets and readability across all screen sizes

# 1.6.4

## Product Image Analysis Integration - January 2025
- **MAJOR ENHANCEMENT**: Integrated OpenAI GPT-4o vision capabilities for comprehensive product image analysis
- **Feature**: Ask Me Anything widget now analyzes up to 5 product images to extract additional context
- **Capability**: AI can now read nutritional information, specifications, care instructions, and other details from product images
- **Use Case**: Customers can ask about information visible in images but not in text descriptions (e.g., "How many calories does this have?" when nutritional info is only in images)
- **Technical**: 
  - Enhanced Liquid template to extract and pass product image URLs to frontend
  - Updated JavaScript to include image URLs in API requests
  - Modified backend to use GPT-4o (vision-capable) when images are present, fallback to GPT-4o-mini for text-only
  - Implemented proper URL validation and error handling for image processing
  - Added detailed prompts instructing AI to analyze images for specifications, ingredients, dimensions, and visual details
- **Performance**: Automatic model selection (GPT-4o for images, GPT-4o-mini for text-only) optimizes both capability and cost
- **Reliability**: Graceful fallback when image processing fails, ensuring uninterrupted service
- **User Experience**: More comprehensive and accurate answers by combining text and visual product information

# 1.6.3

## Enhanced Text Animation with Aceternity UI Effect - January 2025
- **ENHANCEMENT**: Replaced text reveal animations with modern word-by-word fade-in effect
- **Feature**: Implemented vanilla JavaScript version of Aceternity UI Text Generate Effect
- **Technical**: 
  - Created `text-generate-effect.js` with configurable duration, stagger delay, and blur options
  - Replaced CSS keyframe animations (`textRevealClipBlurAMA`, `textRevealClipBlurReview`) with JavaScript-based animations
  - Updated both Ask Me Anything and Review Summary blocks to use the new effect
- **User Experience**: Text now animates in word-by-word with smooth blur-to-clear transitions
- **Accessibility**: Maintains semantic HTML structure while enhancing visual appeal
- **Performance**: Lightweight vanilla JS implementation with proper cleanup and error handling

# 1.6.2

## Store Information Persistence Fix - January 2025
- **CRITICAL FIX**: Fixed store information not persisting after save and refresh
- **Issue**: Store information form data was disappearing when admin refreshed the page
- **Solution**: Replaced inefficient fetch-based loading with direct database queries
- **Technical**: Fixed database imports and added proper form state management after saves
- **Enhancement**: Added comprehensive logging for debugging store information operations
- **User Experience**: Store information now properly saves and displays when returning to the admin interface

# 1.6.1

## Store Information Integration - January 2025
- **ENHANCEMENT**: Connected Store Information from admin dashboard to AI prompts
- **Feature**: Ask Me Anything widget now includes store policies, shipping info, hours, and contact details in AI responses
- **Improvement**: Suggested questions feature now generates context-aware questions about both products AND store policies
- **Technical**: Modified `ask-openai.tsx` to fetch and integrate store information from database into AI prompts
- **User Experience**: Customers can now ask about shipping policies, return processes, store hours, and services and get accurate answers
- **Admin Benefit**: Store information configured in the "Store Information" tab now enhances all AI interactions

# 1.6.0

## Review Data Integration Fix - January 2025
- **CRITICAL FIX**: Fixed review data not being included in ask-me-anything AI responses
- **Issue**: The ask-me-anything feature was using `fetchJudgeMeReviews()` API calls instead of reliable DOM scraping
- **Solution**: Updated to use `scrapeReviewContent()` method for consistent review data access
- **Impact**: AI can now properly answer review-based questions like "What do customers say about this product?"
- **Technical**: Modified `ask-me-anything.js` to use DOM scraping instead of Judge.me API calls
- **Liquid Template**: Enhanced review data context preparation with fallback mechanisms for various review systems
- **Compatibility**: Added support for Judge.me metafields, native Shopify reviews, and dynamic review loading

## Previous Changes
- Manually bumped version to 1.5.0 in package.json
- Added npm script `version:bump` to allow easy semantic versioning via npm commands

# @shopify/shopify-app-template-remix

## 2025.03.18
-[#998](https://github.com/Shopify/shopify-app-template-remix/pull/998) Update to Vite 6

## 2025.03.01
- [#982](https://github.com/Shopify/shopify-app-template-remix/pull/982) Add Shopify Dev Assistant extension to the VSCode extension recommendations

## 2025.01.31
- [#952](https://github.com/Shopify/shopify-app-template-remix/pull/952) Update to Shopify App API v2025-01

## 2025.01.23

- [#923](https://github.com/Shopify/shopify-app-template-remix/pull/923) Update `@shopify/shopify-app-session-storage-prisma` to v6.0.0

## 2025.01.8

- [#923](https://github.com/Shopify/shopify-app-template-remix/pull/923) Enable GraphQL autocomplete for Javascript

## 2024.12.19

- [#904](https://github.com/Shopify/shopify-app-template-remix/pull/904) bump `@shopify/app-bridge-react` to latest
-
## 2024.12.18

- [875](https://github.com/Shopify/shopify-app-template-remix/pull/875) Add Scopes Update Webhook
## 2024.12.05

- [#910](https://github.com/Shopify/shopify-app-template-remix/pull/910) Install `openssl` in Docker image to fix Prisma (see [#25817](https://github.com/prisma/prisma/issues/25817#issuecomment-2538544254))
- [#907](https://github.com/Shopify/shopify-app-template-remix/pull/907) Move `@remix-run/fs-routes` to `dependencies` to fix Docker image build
- [#899](https://github.com/Shopify/shopify-app-template-remix/pull/899) Disable v3_singleFetch flag
- [#898](https://github.com/Shopify/shopify-app-template-remix/pull/898) Enable the `removeRest` future flag so new apps aren't tempted to use the REST Admin API.

## 2024.12.04

- [#891](https://github.com/Shopify/shopify-app-template-remix/pull/891) Enable remix future flags.
-

## 2024.11.26
- [888](https://github.com/Shopify/shopify-app-template-remix/pull/888) Update restResources version to 2024-10

## 2024.11.06

- [881](https://github.com/Shopify/shopify-app-template-remix/pull/881) Update to the productCreate mutation to use the new ProductCreateInput type

## 2024.10.29

- [876](https://github.com/Shopify/shopify-app-template-remix/pull/876) Update shopify-app-remix to v3.4.0 and shopify-app-session-storage-prisma to v5.1.5

## 2024.10.02

- [863](https://github.com/Shopify/shopify-app-template-remix/pull/863) Update to Shopify App API v2024-10 and shopify-app-remix v3.3.2

## 2024.09.18

- [850](https://github.com/Shopify/shopify-app-template-remix/pull/850) Removed "~" import alias

## 2024.09.17

- [842](https://github.com/Shopify/shopify-app-template-remix/pull/842) Move webhook processing to individual routes

## 2024.08.19

Replaced deprecated `productVariantUpdate` with `productVariantsBulkUpdate`

## v2024.08.06

Allow `SHOP_REDACT` webhook to process without admin context

## v2024.07.16

Started tracking changes and releases using calver

## YYYY.MM.DD
- Removed Vercel deployment configuration and dependencies.
- Switched Prisma database from PostgreSQL to SQLite for standard development setup.
- Corrected Remix resource route path for App Proxy requests.

# ShopAI Changelog

## 2025-01-XX - Project Analysis Session
- Conducted comprehensive analysis of ShopAI app architecture and functionality
- Documented core features: Ask Me Anything widget and Review Summarizer blocks
- Identified AI integration with OpenAI GPT-4o-mini for conversational product assistance
- Mapped out multilingual support (8+ languages) and customizable tone options
- Analyzed Shopify theme extension structure with Liquid templates and modern UI
- Confirmed deployment architecture: Remix app on Fly.io with Prisma/SQLite database
- Verified production readiness with proper error handling and responsive design

## [Security Fix] - 2025-01-09
### Security
- **CRITICAL**: Removed exposed Shopify API keys from repository after GitGuardian detection
- Replaced exposed API keys and client secrets with placeholder values in `.env` and `shopify.app.toml`
- Generated new client secret in Shopify Partner Dashboard
- Revoked old compromised client secret
- Enhanced `.gitignore` to prevent future API key exposure
- Removed `build/` directory containing compiled code with exposed keys
- All exposed credentials have been rotated and secured

### Added
- Comprehensive `.gitignore` patterns for sensitive files and directories
- Security commit removing 44 files with exposed credentials

### Changed
- Updated environment file structure with placeholder values
- Improved repository security posture

## Previous Changes
- [Add your previous changelog entries here]

### 2.1.0 - 2025-08-07
- Feature: Integrated `gpt-5-mini-2025-08-07` across the application for enhanced AI capabilities, replacing older models.
- Chore: Refactored OpenAI API calls to standardize on the new `gpt-5-mini-2025-08-07` model.

### 2.0.0 - 2025-08-06
- Major Feature: Added plan management and usage tracking for customer questions.
- API: New endpoint `incrementQuestionCount` to enforce plan limits.
- UI: Added UI components for plan selection and upgrade.
