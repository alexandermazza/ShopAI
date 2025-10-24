# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ShopAI is a Shopify embedded app that provides AI-powered product Q&A and review summarization directly on product pages through Shopify Theme App Extensions. Built with Remix, Prisma, and OpenAI's GPT models.

## Key Commands

### Development
```bash
npm run dev                    # Start Shopify CLI dev server (includes Remix, Prisma, tunneling)
npm run build                  # Build Remix app and generate Prisma client
npm run start                  # Production server using Remix serve
```

### Database
```bash
npm run setup                  # Reset database and run all migrations
npm run db:migrate             # Create and apply new Prisma migration
npx prisma generate            # Generate Prisma client after schema changes
npx prisma db push             # Push schema changes without migration (dev only)
```

### Asset Minification
```bash
npm run minify                 # Minify all theme extension JavaScript assets
npm run minify:ask-me-anything # Minify ask-me-anything.js only
npm run minify:review-summary  # Minify review-summary.js only
npm run minify:text-generate   # Minify text-generate-effect.js only
```

### Deployment & Shopify CLI
```bash
npm run deploy                 # Deploy app to Shopify (requires production config)
npm run config:link            # Link local app to Shopify Partners app
npm run config:use             # Switch between app configurations
```

### Code Quality
```bash
npm run lint                   # Run ESLint with caching
```

## Architecture

### High-Level Structure

**Shopify Embedded App (Remix)**
- Admin interface for store configuration and analytics dashboard
- Built with Remix (React-based framework) using Shopify App Bridge
- Uses Shopify Polaris design system for native Shopify admin look
- Authentication via `@shopify/shopify-app-remix`

**Theme App Extensions (Liquid + Vanilla JS)**
- Two blocks: "Ask Me Anything" (AI Q&A widget) and "Review Summary" (AI review summaries)
- Located in `extensions/shop-ai/blocks/`
- Pure Liquid templates with vanilla JavaScript (no React in storefront)
- JavaScript minified using Terser for production

**Backend Routes**
- App Proxy routes (`/apps/proxy/*`) handle storefront-facing API requests
- Admin routes (`/app/*`) handle merchant dashboard and configuration
- Resource routes handle OpenAI API calls and review processing

### Key Architectural Patterns

**App Proxy Architecture**
- Shopify App Proxy routes requests from storefront (`/apps/proxy/*`) to backend
- Configuration in `shopify.app.toml` under `[app_proxy]`
- Allows theme extension JavaScript to call backend APIs without CORS issues
- Shop domain passed via query parameter by Shopify App Proxy

**Dual Route Pattern for API Endpoints**
- Many endpoints have both a direct route and an app proxy route
- Example: `resource-openai.tsx` and `apps.proxy.resource-openai.tsx`
- App proxy routes typically re-export from the main resource route
- This pattern supports both embedded admin and storefront access

**AI Model Selection**
- Currently using GPT-5 Nano (`gpt-5-nano`) for all operations (unified multimodal model)
- Historical: Used to conditionally select GPT-4o for vision vs GPT-4o-mini for text
- Vision analysis triggered by keywords (color, size, nutrition, ingredients, dimensions, etc.)
- Product images passed to OpenAI API for visual analysis when needed

### Database Architecture (Prisma + PostgreSQL)

**Core Models:**
- `Session` - Shopify app session storage (managed by Shopify SDK)
- `StoreInformation` - Merchant store context (policies, hours, description) used to enhance AI responses
- `CustomerQuestion` - Aggregated question counts (normalized, deduplicated)
- `CustomerQuestionEvent` - Immutable event log of every question asked (for analytics)
- `ProductPageView` - Tracks product page views for dashboard analytics

**Question Storage Pattern:**
- Questions are normalized (lowercase, whitespace collapsed) and deduplicated in `CustomerQuestion`
- Each raw question is also logged as an immutable event in `CustomerQuestionEvent`
- Dashboard uses `CustomerQuestionEvent` for accurate daily time-series data
- Fallback to `CustomerQuestion` if event log is empty (backwards compatibility)

### OpenAI Integration

**Primary Endpoint:** `app/routes/resource-openai.tsx`
- Handles two operations: `answerQuestion` (default) and `getSuggestedQuestions`
- Shop domain extracted from URL query params (App Proxy pattern)
- Fetches `StoreInformation` from database to enhance prompts with store policies
- Product images passed as array, validated, and included in vision requests
- Vision analysis uses high detail mode for nutritional info, specs, text reading
- Responses cleaned of markdown formatting for plain text output

**Key Features:**
- Store context injection: AI responses include shipping/return policies from merchant settings
- Smart vision detection: Analyzes question keywords to determine if image analysis is needed
- Image validation: Filters invalid URLs before sending to OpenAI
- Error handling: Non-blocking database logging (errors don't interrupt user experience)

### Theme Extension Structure

**Liquid Templates** (`extensions/shop-ai/blocks/`)
- Extract comprehensive product context (title, description, variants, pricing, images, reviews)
- Generate data attributes for JavaScript consumption
- Configurable via Shopify Theme Editor (language, placeholder text, logo, colors)
- Support for Judge.me reviews via metafields and DOM scraping

**JavaScript Assets** (`extensions/shop-ai/assets/`)
- Vanilla JavaScript with no framework dependencies
- Minified versions loaded in production (`.min.js`)
- `ask-me-anything.js`: Handles Q&A widget interaction, API calls, text animation
- `review-summary.js`: Fetches and displays AI-generated review summaries
- `suggested-questions.js`: Loads and displays AI-generated suggested questions
- `text-generate-effect.js`: Word-by-word text reveal animation

**Configuration Files**
- `shopify.extension.toml`: Extension metadata, network access, block definitions
- `shopify.app.toml`: App configuration, webhooks, app proxy settings, scopes

### Dashboard & Analytics

**Dashboard Route:** `app/routes/app.dashboard.tsx`
- Built with Shopify Polaris components (Cards, DataTable, Charts)
- Uses Chart.js with react-chartjs-2 for visualizations
- Displays: total questions, unique questions, avg per day, page views
- Time-series charts with date range filtering
- Recent questions table and top questions by frequency

**Data Aggregation:**
- Uses local day bucketing (avoids UTC timezone issues)
- Aggregates `CustomerQuestionEvent` data by day for accurate time-series
- Falls back to `CustomerQuestion` aggregation if events unavailable
- Page view tracking via `ProductPageView` model

## Important Development Notes

### Cursor Rules Integration

When modifying Shopify theme extensions or React components, follow these guidelines from `.cursor/rules/shopify-expert.mdc`:

**TypeScript & React:**
- Use functional, declarative components only
- Interfaces over types/enums (use maps for enum-like behavior)
- RORO pattern (Receive an Object, Return an Object)
- Named exports, lowercase-dash folder structure

**Styling:**
- Tailwind CSS for all layout/style (no separate CSS files) in admin
- Mobile-first responsive design
- Avoid `className` ternaries, use `class:` directives

**OpenAI Chat Integration:**
- Stream responses where possible (use async generators)
- Handle rate limiting with retry/backoff logic
- Sanitize all user input before API calls
- Display user-friendly errors (quota exceeded, model unavailable)
- Optimistic UI for chat inputs

**Shopify Compliance:**
- Follow theme extension APIs strictly
- Handle metafields and dynamic sections properly
- Respect Liquid rendering lifecycle

### Changelog Maintenance

**Always update CHANGELOG.md after every development session** (from `.cursor/rules/changelog.mdc`)

Use semantic versioning and include:
- User-facing feature descriptions
- Bug fixes with context
- Technical implementation details
- Performance impacts and cost optimizations

### Testing & Deployment

**Local Development:**
- Use `npm run dev` which starts Shopify CLI (handles tunneling, HTTPS, OAuth)
- Shopify CLI uses ngrok-like tunneling for local testing with real Shopify stores
- Test theme extensions in Theme Editor (Shopify admin → Online Store → Themes → Customize)

**Database Migrations:**
- Always create migrations for schema changes: `npm run db:migrate`
- Do NOT use `npx prisma db push` in production (use migrations only)
- Run `npx prisma generate` after any schema.prisma changes

**Asset Minification:**
- Run `npm run minify` before deploying to production
- Minified JS files are what get loaded in theme extensions
- Source files (`.js`) and minified files (`.min.js`) are both tracked

### Common Gotchas

**App Proxy Routes:**
- Shop domain comes from URL query params, not headers
- Use pattern: `const shopDomain = url.searchParams.get('shop') || ''`
- Don't assume authenticated session in App Proxy routes

**Prisma Client:**
- Must run `npx prisma generate` after schema changes before build
- Import from `../db.server` for consistent client usage
- Database migrations auto-run in Docker start script

**OpenAI API:**
- Max context length: 15,000 chars for product context
- Max question length: 300 chars
- Use `max_completion_tokens` (not `max_tokens`) for GPT-5 models
- GPT-5 Nano does not support custom `temperature` parameter

**Shopify Authentication:**
- Admin routes use `authenticate.admin(request)` from `shopify.server.ts`
- Theme extension routes (App Proxy) are unauthenticated by design
- Embedded app uses new authentication strategy: `unstable_newEmbeddedAuthStrategy: true`

## File References

**Core Configuration:**
- `shopify.app.toml` - Shopify app configuration, webhooks, app proxy
- `extensions/shop-ai/shopify.extension.toml` - Theme extension config
- `prisma/schema.prisma` - Database schema
- `package.json` - Dependencies and scripts

**Key Backend Routes:**
- `app/shopify.server.ts` - Shopify app initialization, auth, HMAC verification
- `app/routes/resource-openai.tsx` - OpenAI API integration (Q&A + suggestions)
- `app/routes/app.dashboard.tsx` - Analytics dashboard
- `app/routes/app.store-context.tsx` - Store information management

**Theme Extension Files:**
- `extensions/shop-ai/blocks/ask-me-anything.liquid` - Q&A widget Liquid template
- `extensions/shop-ai/blocks/review-summary.liquid` - Review summary Liquid template
- `extensions/shop-ai/assets/ask-me-anything.js` - Q&A widget JavaScript (source)
- `extensions/shop-ai/assets/ask-me-anything.min.js` - Q&A widget JavaScript (production)

## Environment Variables

Required for development and production:

- `SHOPIFY_API_KEY` - Shopify app API key
- `SHOPIFY_API_SECRET` - Shopify app secret
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for GPT models
- `SCOPES` - Shopify API scopes (comma-separated)
- `SHOPIFY_APP_URL` - Public app URL (for OAuth redirects)
