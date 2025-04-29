const ReviewSummary = {
  // --- Helper to wait for Judge.me reviews (copied from ask-me-anything.js) ---
  async waitForJudgeMeReviews(maxWaitMs = 20000) {
    let reviews = document.querySelectorAll('.jdgm-rev');
    if (reviews.length > 0) {
      // console.log('ReviewSummary: Found .jdgm-rev reviews immediately:', reviews.length);
      return reviews;
    }
    return new Promise(resolve => {
      let found = false;
      const observer = new MutationObserver(() => {
        const reviewsNow = document.querySelectorAll('.jdgm-rev');
        if (reviewsNow.length > 0) {
          found = true;
          // console.log('ReviewSummary: MutationObserver found .jdgm-rev reviews:', reviewsNow.length);
          observer.disconnect();
          resolve(reviewsNow);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        if (!found) {
          observer.disconnect();
          const reviewsNow = document.querySelectorAll('.jdgm-rev');
          // console.log('ReviewSummary: Timeout, found .jdgm-rev reviews:', reviewsNow.length);
          resolve(reviewsNow);
        }
      }, maxWaitMs);
    });
  },

  // --- Helper Function to Scrape Reviews (Adapted for summarization input) ---
  async scrapeReviewContent() {
    // console.log("ReviewSummary: Attempting to scrape review content from DOM.");
    let reviewSnippets = []; // Array to hold individual review snippets

    // Use robust waiting logic for Judge.me reviews
    const judgeMeReviews = await this.waitForJudgeMeReviews();
    if (judgeMeReviews.length > 0) {
      // console.log(`ReviewSummary: Processing ${judgeMeReviews.length} Judge.me review elements.`);
      judgeMeReviews.forEach((reviewElement, index) => {
        if (index >= 10) return; // Limit number of reviews sent for summary (adjust as needed)
        const ratingElement = reviewElement.querySelector('.jdgm-rev__rating');
        const bodyP = reviewElement.querySelector('.jdgm-rev__body p');
        const bodyDiv = reviewElement.querySelector('.jdgm-rev__body');
        let bodyText = '';
        if (bodyP && bodyP.textContent.trim()) {
          bodyText = bodyP.textContent.trim();
        } else if (bodyDiv && bodyDiv.textContent.trim()) {
          bodyText = bodyDiv.textContent.trim();
        }
        const rating = ratingElement ? (ratingElement.getAttribute('data-score') || ratingElement.textContent.trim() || '?') : '?';
        if (bodyText) { // Only include reviews with text content
            reviewSnippets.push(`Rating: ${rating}/5 - Comment: "${bodyText}"`);
        }
      });
    } else {
      // Try native Shopify reviews (example selectors, adjust as needed)
      let nativeReviews = document.querySelectorAll('.spr-review');
      if (nativeReviews.length === 0) {
        nativeReviews = document.querySelectorAll('.shopify-product-reviews .review');
      }
      if (nativeReviews.length > 0) {
        // console.log(`ReviewSummary: Found ${nativeReviews.length} native Shopify review elements.`);
        nativeReviews.forEach((reviewElement, index) => {
          if (index >= 10) return;
          const ratingElement = reviewElement.querySelector('.spr-review-rating, .review-rating');
          const bodyElement = reviewElement.querySelector('.spr-review-content, .review-content');
          const rating = ratingElement ? ratingElement.textContent.trim().replace(/\s+/g, ' ') : '?';
          const body = bodyElement ? bodyElement.textContent.trim().replace(/\s+/g, ' ') : '';
          if (body) { // Only include reviews with text content
            reviewSnippets.push(`Rating: ${rating}/5 - Comment: "${body}"`);
          }
        });
      }
    }

    if (reviewSnippets.length === 0) {
      // console.log("ReviewSummary: No review content scraped from the page.");
      return null; // Return null if no reviews found
    }

    // Join snippets into a single string for the API
    const combinedReviewText = reviewSnippets.join('\n');
    // console.log(`ReviewSummary: Scraped ${reviewSnippets.length} reviews for summary.`);
    return combinedReviewText;
  },

  async onMount(containerElement = document) {
    // console.log('ReviewSummary: onMount called for container:', containerElement);
    if (!containerElement || containerElement.id !== 'review-summary-block') {
        console.error('ReviewSummary: Invalid containerElement passed to onMount:', containerElement);
        return;
    }

    const responseArea = containerElement.querySelector('.summary-response-area');
    const summaryContentElement = responseArea?.querySelector('.ai-summary-content');
    const attributionElement = responseArea?.querySelector('.summary-attribution');

    if (!responseArea || !summaryContentElement || !attributionElement) {
      console.error('ReviewSummary: Missing required elements.');
      // Keep essential error logs
      if(!responseArea) console.error('>>> ReviewSummary: responseArea missing');
      if(!summaryContentElement) console.error('>>> ReviewSummary: summaryContentElement missing');
      if(!attributionElement) console.error('>>> ReviewSummary: attributionElement missing');
      containerElement.style.display = 'none'; // Ensure block stays hidden on error
      return;
    }

    // --- Scrape review content --- 
    const scrapedReviews = await this.scrapeReviewContent();

    console.log("ReviewSummary: scrapedReviews to send:", scrapedReviews);

    if (!scrapedReviews) {
        // console.log('ReviewSummary: No reviews found, hiding block.');
        containerElement.style.display = 'none'; // Keep block hidden
        return;
    }

    // --- Reviews found, show block and fetch summary --- 
    // console.log('ReviewSummary: Reviews found, making block visible and fetching summary.');
    containerElement.classList.add('visible'); // Make the container visible via CSS class
    summaryContentElement.textContent = ''; // Clear previous content
    responseArea.classList.remove('error');
    responseArea.classList.add('loading'); // Show loading state
    attributionElement.classList.add('hidden');

    // Use the App Proxy path for the new resource route
    const apiUrl = '/apps/proxy/resource-review-summary'; 

    try {
      // console.log(`ReviewSummary: Calling API via App Proxy (streaming): ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scrapedReviews: scrapedReviews, // Send scraped reviews
        }),
      });

      // --- Check Response Status --- 
      console.log(`>>> ReviewSummary: Response status: ${response.status}, ok: ${response.ok}`); // Log status
      if (!response.ok) {
        let errorMessage = `API Error: ${response.status} ${response.statusText}`; 
        try {
          const errorJson = await response.json(); // Try to parse error JSON
          errorMessage = errorJson.error || errorJson.details || errorJson.message || errorMessage;
        } catch (e) {
            try {
              const errorText = await response.text(); // Fallback to text
              if (errorText.startsWith('Error:')) {
                  errorMessage = errorText;
              } else if (response.headers.get('content-type')?.includes('text/html')) {
                  errorMessage = `App Proxy Error ${response.status}: Check backend server or proxy config.`;
                  console.error("ReviewSummary: Received HTML error page from App Proxy.");
              } else {
                  console.warn("ReviewSummary: Received non-JSON, non-standard error response body:", errorText);
              }
            } catch (readError) {
               console.error('ReviewSummary: Failed to read error response body:', readError); // Keep critical error
            }
        }
        throw new Error(errorMessage);
      }

      // --- Handle NON-STREAMED JSON Response --- 
      console.log(">>> ReviewSummary: Receiving non-streamed JSON response...");
      summaryContentElement.textContent = ''; // Ensure clear
      responseArea.classList.remove('loading'); // Remove loading state
      containerElement.classList.add('loaded'); // Add class to trigger fade-in

      let summaryText = "Sorry, could not parse the summary."; // Default error
      try {
        const data = await response.json();
        console.log(">>> ReviewSummary: Received JSON data:", data);
        if (data && data.summary) {
           summaryText = data.summary;
        } else {
           console.error(">>> ReviewSummary: JSON response missing 'summary' property.");
           summaryText = data.error || summaryText; // Use error from JSON if available
           responseArea.classList.add('error');
        }
      } catch (parseError) {
         console.error(">>> ReviewSummary: Error parsing JSON response:", parseError);
         responseArea.classList.add('error');
      }

      summaryContentElement.textContent = summaryText;
      if (!responseArea.classList.contains('error')) {
          attributionElement.classList.remove('hidden');
      } else {
          attributionElement.classList.add('hidden'); // Hide attribution on error
      }

    } catch (error) { // Catches fetch errors, response.ok=false etc.
      console.log(">>> ReviewSummary: CATCH BLOCK ENTERED <<<");
      console.error('ReviewSummary: Error during fetch setup or initial response handling:', error); // Keep critical error
      summaryContentElement.textContent = `Error: ${error.message || 'Could not load summary.'}`;
      responseArea.classList.remove('loading');
      responseArea.classList.add('error');
      containerElement.classList.add('loaded'); // Still trigger fade-in for error message
      attributionElement.classList.remove('hidden');
    } finally {
      // No input to re-enable here
      // console.log('ReviewSummary: Processing complete.');
    }
  }
};

// Register the block
window.ReviewSummary = ReviewSummary;

// Initialization logic using Shopify Events
document.addEventListener('shopify:section:load', function(event) {
  // console.log('ReviewSummary: shopify:section:load event fired.');
  const sectionId = event.detail.sectionId;
  const sectionElement = document.getElementById(`shopify-section-${sectionId}`);
  if (!sectionElement) {
     // console.log('ReviewSummary: Section element not found for ID:', sectionId);
     return;
  }
  const container = sectionElement.querySelector(`#review-summary-block`);

  if (container && container.dataset.initialized !== 'true') {
    // console.log('ReviewSummary: Initializing component via section:load.');
    ReviewSummary.onMount(container);
    container.dataset.initialized = 'true';
  } else if (container) {
      // console.log('ReviewSummary: Component already initialized (section:load).');
  } else {
      // console.log('ReviewSummary: Container #review-summary-block not found in loaded section.');
  }
});

document.addEventListener('DOMContentLoaded', () => {
    // console.log('ReviewSummary: DOMContentLoaded event fired.');
    document.querySelectorAll('#review-summary-block:not([data-initialized="true"])').forEach(container => {
        // console.log('ReviewSummary: Initializing component via DOMContentLoaded.');
        ReviewSummary.onMount(container);
        container.dataset.initialized = 'true';
    });
}); 