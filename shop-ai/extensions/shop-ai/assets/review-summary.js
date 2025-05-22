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

    // --- Get tone_of_voice from block settings ---
    let toneOfVoice = 'default';
    if (containerElement && containerElement.hasAttribute('data-block-settings')) {
      try {
        const settings = JSON.parse(containerElement.getAttribute('data-block-settings'));
        if (settings && settings.tone_of_voice) {
          toneOfVoice = settings.tone_of_voice;
        }
      } catch (e) {
        console.warn('ReviewSummary: Failed to parse data-block-settings for tone_of_voice:', e);
      }
    }

    console.log("ReviewSummary: scrapedReviews to send:", scrapedReviews, "toneOfVoice:", toneOfVoice);

    if (!scrapedReviews) {
        // console.log('ReviewSummary: No reviews found, hiding block.');
        containerElement.style.display = 'none'; // Keep block hidden
        return;
    }

    // --- Reviews found, show block and fetch summary --- 
    console.log(">>> ReviewSummary: Elements Check:", { containerElement, summaryContentElement, responseArea, attributionElement }); // Log elements
    containerElement.classList.add('visible'); // Make the container visible via CSS class
    summaryContentElement.textContent = ''; // Clear previous content
    responseArea.classList.remove('error');
    responseArea.classList.add('loading'); // Show loading state
    attributionElement.classList.add('hidden');

    // Use the App Proxy path for the new resource route
    const apiUrl = '/apps/proxy/resource-review-summary'; 

    console.log(">>> ReviewSummary: BEFORE fetch call"); // Log before fetch

    try {
      // console.log(`ReviewSummary: Calling API via App Proxy (streaming): ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scrapedReviews: scrapedReviews, // Send scraped reviews
          toneOfVoice: toneOfVoice !== 'default' ? toneOfVoice : undefined // Only send if not default
        }),
      });

      console.log(">>> ReviewSummary: AFTER fetch call, Status:", response.status); // Log after fetch

      // --- Check Response Status --- 
      console.log(`>>> ReviewSummary: Response status: ${response.status}, ok: ${response.ok}`); // Log status
      if (!response.ok) {
        console.error(">>> ReviewSummary: Response not OK", response.status, response.statusText);
        throw new Error(`API Error: ${response.status}`); // Simplified error
      }

      // --- Handle NON-STREAMED JSON Response --- 
      console.log(">>> ReviewSummary: Receiving non-streamed JSON response...");
      summaryContentElement.textContent = ''; // Ensure clear
      responseArea.classList.remove('loading'); // Remove loading state
      containerElement.classList.add('loaded'); // Add class to trigger fade-in

      // Log the response content type
      const contentType = response.headers.get("content-type");
      console.log(">>> ReviewSummary: Response Content-Type:", contentType);

      let summaryText = "Sorry, could not parse the summary."; // Default error
      console.log(">>> ReviewSummary: BEFORE response.json()"); // Log before parsing
      try {
        const data = await response.json();
        console.log(">>> ReviewSummary: AFTER response.json(), Data:", data); // Log parsed data
        if (data && typeof data.summary === 'string') { // More specific check
           summaryText = data.summary;
        } else {
           console.error(">>> ReviewSummary: Invalid data structure", data);
           summaryText = "Error: Invalid response format.";
           responseArea.classList.add('error');
        }
      } catch (parseError) {
         console.error(">>> ReviewSummary: Error parsing JSON response:", parseError);
         // Try to get raw text if JSON parsing failed
         try {
             const rawText = await response.text(); // Need to clone response or re-fetch to read body again
             console.warn(">>> ReviewSummary: Displaying raw text due to JSON parse error:", rawText);
             summaryText = rawText;
         } catch (textError) {
             console.error(">>> ReviewSummary: Failed to get raw text after JSON parse error:", textError);
             summaryText = "Error loading summary."; // Final fallback
         }
         responseArea.classList.add('error');
      }

      // --- Apply animation if no error ---
      summaryContentElement.textContent = ''; // Clear before setting
      summaryContentElement.classList.remove('animate-text-reveal'); // Reset before applying

      summaryContentElement.textContent = summaryText;

      if (!responseArea.classList.contains('error')) {
        summaryContentElement.classList.add('animate-text-reveal');
        attributionElement.classList.remove('hidden');
      } else {
        attributionElement.classList.add('hidden'); // Hide attribution on error
      }

    } catch (error) { // Catches fetch errors, response.ok=false etc.
      console.error('>>> ReviewSummary: CATCH BLOCK error:', error); // Log any error caught
      summaryContentElement.textContent = `Error: ${error.message || 'Could not load summary.'}`;
      responseArea.classList.remove('loading');
      responseArea.classList.add('error');
      containerElement.classList.add('loaded'); 
      attributionElement.classList.add('hidden'); // Hide attribution on error
    } finally {
        console.log(">>> ReviewSummary: FINALLY block reached"); // Log that finally was reached
        // Optional: Ensure loading is always removed
        // responseArea.classList.remove('loading'); 
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