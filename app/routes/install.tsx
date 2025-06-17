import { type LoaderFunction, redirect } from "@remix-run/node";

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const state = url.searchParams.get("state");
  const customParam = url.searchParams.get("customParam");

  console.log("📝 Install route: Capturing custom parameters", { 
    shop, 
    state, 
    customParam,
    url: request.url 
  });

  if (!shop) {
    throw new Error("Shop parameter is required");
  }

  // Store the custom parameters in a temporary way (you can use your database)
  // For now, we'll pass them as query parameters to the OAuth flow
  if (state || customParam) {
    // Store the custom data in your database temporarily
    // This is just an example - implement according to your needs
    console.log("📝 Install route: Custom installation detected", {
      shop,
      customData: { state, customParam }
    });
    
    // TODO: Store this in your database linked to the shop
    // Example:
    // await prisma.tempInstallData.create({
    //   data: {
    //     shop,
    //     customState: state,
    //     customParam,
    //     expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    //   }
    // });
  }

  // Redirect to the standard app route which will trigger OAuth
  return redirect(`/app?shop=${shop}&embedded=1`);
}; 