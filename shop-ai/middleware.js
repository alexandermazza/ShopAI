export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public directory
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};

export default function middleware(request) {
  console.log('📝 Middleware: Processing request', request.url);
  
  // Create new headers object and add the headers we need
  const responseHeaders = new Headers();
  
  // Add headers for iframe embedding
  responseHeaders.set('Content-Security-Policy', "frame-ancestors 'self' https://*.myshopify.com https://*.shopify.com https://admin.shopify.com");
  responseHeaders.set('X-Frame-Options', 'SAMEORIGIN');
  
  // Add CORS headers
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');
  
  // Log the headers being set
  console.log('📝 Middleware: Setting headers', {
    'Content-Security-Policy': responseHeaders.get('Content-Security-Policy'),
    'X-Frame-Options': responseHeaders.get('X-Frame-Options'),
  });
  
  // For OPTIONS requests, send only the headers (preflight response)
  if (request.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: responseHeaders 
    });
  }
  
  // For all other requests, return a Response using NextResponse.next()
  // with the headers applied
  return new Response(null, {
    status: 200,
    headers: responseHeaders
  });
} 