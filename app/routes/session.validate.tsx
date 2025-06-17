import { json, type LoaderFunction, type ActionFunction } from "@remix-run/node";
import { authenticate } from "../shopify.server.js";

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    
    return json({
      valid: true,
      shop: session.shop,
      scope: session.scope,
    });
  } catch (error) {
    console.error("Session validation failed:", error);
    return json({
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 401 });
  }
};

export const action: ActionFunction = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    
    return json({
      valid: true,
      shop: session.shop,
      scope: session.scope,
    });
  } catch (error) {
    console.error("Session validation failed:", error);
    return json({
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 401 });
  }
}; 