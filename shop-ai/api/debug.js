export default function handler(req, res) {
  // Security check - only allow in non-production environments or with a special header
  if (process.env.NODE_ENV === 'production' && req.headers['x-debug-key'] !== process.env.DEBUG_SECRET) {
    return res.status(403).json({ error: 'Not authorized for debug info in production' });
  }
  
  // Gather environment info
  const environment = {
    node_env: process.env.NODE_ENV,
    app_url: process.env.SHOPIFY_APP_URL,
    database_url: process.env.DATABASE_URL ? '[REDACTED]' : 'Not set',
    openai_key: process.env.OPENAI_API_KEY ? '[REDACTED]' : 'Not set',
    vercel_env: process.env.VERCEL_ENV,
    vercel_region: process.env.VERCEL_REGION
  };
  
  // Get request info
  const requestInfo = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query
  };
  
  // Return detailed debug info
  res.status(200).json({
    timestamp: new Date().toISOString(),
    environment,
    request: requestInfo,
    headers: {
      set: {
        'Content-Security-Policy': "frame-ancestors 'self' https://*.myshopify.com https://*.shopify.com https://admin.shopify.com",
        'X-Frame-Options': 'SAMEORIGIN'
      }
    }
  });
} 