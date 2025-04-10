import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import compression from "compression";
import express from "express";
import morgan from "morgan";

installGlobals();

// Dynamic import for development server
const getViteDevServer = async () => {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }
  
  const vite = await import("vite");
  return vite.createServer({
    server: { middlewareMode: true },
  });
};

// Self-invoking async function to set up the server
(async () => {
  const viteDevServer = await getViteDevServer();
  const app = express();
  
  app.use(compression());
  
  // http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
  app.disable("x-powered-by");
  
  // Remix fingerprints its assets so we can cache forever.
  app.use(
    "/build",
    express.static("public/build", { immutable: true, maxAge: "1y" })
  );
  
  // Logging
  app.use(morgan("tiny"));
  
  // Everything else (like favicon.ico) is cached for an hour. You may want to be
  // more aggressive with this caching.
  app.use(express.static("public", { maxAge: "1h" }));
  
  // Add headers for Shopify embedding
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.myshopify.com https://*.shopify.com https://admin.shopify.com");
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });
  
  // Handle API routes
  app.get('/health', (req, res) => {
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
  });
  
  // Handle debug route
  app.get('/debug', (req, res) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-debug-key'] !== process.env.DEBUG_SECRET) {
      return res.status(403).json({ error: 'Not authorized for debug info in production' });
    }
    
    res.status(200).json({
      timestamp: new Date().toISOString(),
      environment: {
        node_env: process.env.NODE_ENV,
        app_url: process.env.SHOPIFY_APP_URL,
        database_url: process.env.DATABASE_URL ? '[REDACTED]' : 'Not set',
        openai_key: process.env.OPENAI_API_KEY ? '[REDACTED]' : 'Not set',
      },
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers
      }
    });
  });
  
  // This is used to handle API proxies for Shopify
  app.use('/api/*', (req, res, next) => {
    console.log('API proxy request:', req.originalUrl);
    next();
  });
  
  // Then, use Remix to handle everything else
  app.all(
    "*",
    createRequestHandler({
      build: viteDevServer
        ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
        : await import("./build/server/index.js"),
    })
  );
  
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Express server listening on port ${port}`);
  });
})(); 