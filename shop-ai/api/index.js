// Simple handler for Vercel to ensure the root path works
export default function handler(req, res) {
  // Log the incoming request for debugging
  console.log('Root API handler called', {
    url: req.url,
    method: req.method
  });
  
  // Set headers for Shopify iframe embedding
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.myshopify.com https://*.shopify.com https://admin.shopify.com");
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Always redirect to the app
  res.status(307).setHeader('Location', '/app').end();
}
