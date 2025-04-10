export default function handler(req, res) {
  // Log the health check
  console.log('Health check called', {
    url: req.url,
    method: req.method,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL ? 'Set' : 'Not set',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Not set',
      DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set'
    }
  });
  
  // Return health status
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    appUrl: process.env.SHOPIFY_APP_URL || 'Not set',
    services: {
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
      database: process.env.DATABASE_URL ? 'configured' : 'not configured'
    }
  });
} 