# Deploying to Vercel

This guide will help you deploy your Shopify app to Vercel successfully.

## Prerequisites

- A Vercel account
- Your Supabase database credentials
- Shopify API credentials

## Environment Variables

Make sure to set the following environment variables in your Vercel project settings:

```
OPENAI_API_KEY=your_openai_key
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_SHOPAI_ID=your_shopify_app_id
DATABASE_URL=postgres://postgres.your_db_id:your_password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?connection_limit=1&pool_timeout=0&socket_timeout=300
DIRECT_URL=postgres://postgres.your_db_id:your_password@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
NODE_ENV=production
SKIP_BUILD_SCRIPT=true
SHOPIFY_APP_URL=your_vercel_domain_here
SCOPES=read_products
```

## Important Supabase Notes

For Supabase connections, we use two URLs:
- `DATABASE_URL`: Used for connection pooling with performance optimizations
- `DIRECT_URL`: Used for direct connections and migrations

Make sure your Supabase database has:
1. Network access allowed from Vercel's IP addresses
2. A strong password set
3. SSL enabled

## Deployment Steps

1. Connect your GitHub repository to Vercel
2. Configure the environment variables as listed above
3. Use the following build settings:
   - Build Command: `npm run vercel-build`
   - Output Directory: `public`
   - Install Command: `npm install --legacy-peer-deps`

## Troubleshooting

If you encounter database connection issues:

1. Check that your Supabase database is accessible from external services
2. Verify that your DATABASE_URL uses the correct format
3. Ensure your database allows connections from Vercel's IP addresses

For Prisma-specific issues:

1. Run `npx prisma generate` locally to ensure your Prisma schema is valid
2. If using Prisma migrations, run `npx prisma migrate deploy` locally first to set up your database schema

## Post-Deployment

After successful deployment:

1. Update your Shopify App URL in the Shopify Partners dashboard
2. Update the `SHOPIFY_APP_URL` environment variable in Vercel
3. Reinstall your app in your development store to ensure everything is working correctly 