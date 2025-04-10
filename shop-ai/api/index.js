// Simple handler for Vercel to ensure the root path works
export default function handler(req, res) {
  // Log the incoming request for debugging
  console.log('Root API handler called', {
    url: req.url,
    method: req.method,
    headers: req.headers
  });
  
  // Set headers for Shopify iframe embedding
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://*.myshopify.com https://*.shopify.com https://admin.shopify.com");
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Return a simple response or redirect to the app
  if (req.url === '/' || req.url === '') {
    // Redirect to the app route if no shop is specified
    res.redirect(302, '/app');
  } else {
    // Pass through to Remix handler
    res.status(200).json({ message: 'ShopAI API is running!' });
  }
}
