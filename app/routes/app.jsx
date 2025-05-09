// ... existing code ...
    console.error("❌ App route loader: Authentication error", {
      type: typeof error,
      message: error instanceof Error ? error.message : (error?.statusText || JSON.stringify(error) || String(error)), // Try JSON stringify
      status: error?.status,
      isResponse: error instanceof Response,
      stack: error instanceof Error ? error.stack : '',
      raw: error
    });

    // Try to log response details if it's a Response
    if (error instanceof Response) {
      try {
        const clonedResponse = error.clone();
        const responseBody = await clonedResponse.text();
        const responseHeaders = Object.fromEntries(clonedResponse.headers.entries());
        console.error("❌ App route loader: Thrown Response Details", { responseBody, responseHeaders });
      } catch (cloneError) {
        console.error("❌ App route loader: Failed to read thrown Response details", cloneError);
      }
    }

    throw error; // Re-throw the original error
  }
};
// ... existing code ...
