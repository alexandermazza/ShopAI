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

  // --- Helper to get star rating info as fallback ---
  getStarRatingInfo() {
    console.log('ReviewSummary: Looking for star ratings...');
    
    // Try Judge.me metafields from Liquid (if available)
    const productMeta = document.querySelector('[data-judge-me-rating]');
    if (productMeta) {
      const rating = productMeta.dataset.judgeMeRating;
      const count = productMeta.dataset.judgeMeCount;
      if (rating && count) {
        const stars = '★'.repeat(Math.floor(parseFloat(rating))) + '☆'.repeat(5 - Math.floor(parseFloat(rating)));
        return `${stars} ${rating}/5 based on ${count} customer ${count === '1' ? 'review' : 'reviews'}`;
      }
    }
    
    // Try Judge.me widget elements
    const judgeMeWidget = document.querySelector('.jdgm-widget');
    if (judgeMeWidget) {
      const avgRating = judgeMeWidget.querySelector('.jdgm-avg-rating');
      const reviewCount = judgeMeWidget.querySelector('.jdgm-num-reviews');
      if (avgRating && reviewCount) {
        const rating = avgRating.textContent.trim();
        const count = reviewCount.textContent.trim();
        if (rating && count) {
          const stars = '★'.repeat(Math.floor(parseFloat(rating))) + '☆'.repeat(5 - Math.floor(parseFloat(rating)));
          return `${stars} ${rating}/5 based on ${count} customer reviews`;
        }
      }
    }
    
    // Try native Shopify product reviews
    const shopifyRating = document.querySelector('.shopify-product-reviews-badges .spr-badge');
    if (shopifyRating) {
      const rating = shopifyRating.dataset.rating || shopifyRating.querySelector('.spr-starrating')?.dataset.rating;
      const count = shopifyRating.dataset.reviewCount || shopifyRating.querySelector('.spr-review-count')?.textContent;
      if (rating && count) {
        const stars = '★'.repeat(Math.floor(parseFloat(rating))) + '☆'.repeat(5 - Math.floor(parseFloat(rating)));
        return `${stars} ${rating}/5 based on ${count} customer reviews`;
      }
    }
    
    // Try generic star rating selectors
    const starRating = document.querySelector('.rating, .product-rating, .review-rating');
    if (starRating) {
      const ratingText = starRating.textContent.trim();
      const ratingMatch = ratingText.match(/(\d+\.?\d*)\s*\/?\s*5?/);
      if (ratingMatch) {
        const rating = ratingMatch[1];
        const stars = '★'.repeat(Math.floor(parseFloat(rating))) + '☆'.repeat(5 - Math.floor(parseFloat(rating)));
        return `${stars} ${rating}/5 customer rating`;
      }
    }
    
    // Try data attributes on product elements
    const productElement = document.querySelector('[data-product-rating], [data-rating]');
    if (productElement) {
      const rating = productElement.dataset.productRating || productElement.dataset.rating;
      const count = productElement.dataset.reviewCount || productElement.dataset.ratingCount;
      if (rating) {
        const stars = '★'.repeat(Math.floor(parseFloat(rating))) + '☆'.repeat(5 - Math.floor(parseFloat(rating)));
        const countText = count ? ` based on ${count} reviews` : '';
        return `${stars} ${rating}/5${countText}`;
      }
    }
    
    console.log('ReviewSummary: No star rating info found');
    return null;
  },

  // Track product page view when review summary is activated
  async trackPageView() {
    try {
      // Get shop domain from window.Shopify if available
      let shop = null;
      if (window.Shopify && window.Shopify.shop) {
        shop = window.Shopify.shop;
      } else {
        // Fallback: try to extract from location
        shop = window.location.hostname;
      }

      // Get product ID if available
      let productId = null;
      if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
        productId = window.ShopifyAnalytics.meta.product.id?.toString();
      } else if (window.meta && window.meta.product) {
        productId = window.meta.product.id?.toString();
      }

      if (!shop) {
        console.warn('ReviewSummary: Unable to determine shop for page view tracking');
        return;
      }

      // Build URL with shop in query for proxy resolution
      const trackUrl = `/apps/proxy/api/page-view-tracking?shop=${encodeURIComponent(shop)}`;
      // Simple dedupe: avoid double tracking within same tab session for the same product in last 2 minutes
      try {
        const dedupeKey = `shopai_pv_${shop}_${productId || 'x'}`;
        const lastTs = sessionStorage.getItem(dedupeKey);
        const now = Date.now();
        if (lastTs && now - parseInt(lastTs, 10) < 120000) {
          console.log('ReviewSummary: Skipping duplicate page view within 2 minutes');
          return;
        }
        sessionStorage.setItem(dedupeKey, String(now));
      } catch {}

      // Send tracking data to API with retry logic for timing issues
      const response = await fetch(trackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shop: shop,
          productId: productId,
        }),
      });

      if (response.ok) {
        console.log('ReviewSummary: Page view tracked successfully');
      } else {
        console.warn('ReviewSummary: Failed to track page view:', response.status);
      }
    } catch (error) {
      console.warn('ReviewSummary: Page view tracking failed, will retry:', error);

      // Retry once after a short delay for timing issues
      setTimeout(async () => {
        try {
          let retryShop = null;
          if (window.Shopify && window.Shopify.shop) {
            retryShop = window.Shopify.shop;
          } else {
            retryShop = window.location.hostname;
          }

          let retryProductId = null;
          if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
            retryProductId = window.ShopifyAnalytics.meta.product.id?.toString();
          } else if (window.meta && window.meta.product) {
            retryProductId = window.meta.product.id?.toString();
          }

          if (!retryShop) return;

          const retryTrackUrl = `/apps/proxy/api/page-view-tracking?shop=${encodeURIComponent(retryShop)}`;
          const retryResponse = await fetch(retryTrackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop: retryShop, productId: retryProductId }),
          });
          if (retryResponse.ok) {
            console.log('ReviewSummary: Page view tracked on retry');
          }
        } catch (retryError) {
          // Silently fail on retry - page view tracking is not critical
        }
      }, 2000);
    }
  },
  async onMount(containerElement = document) {
    console.log('ReviewSummary: onMount called for container:', containerElement);
    if (!containerElement || containerElement.id !== 'review-summary-block') {
        console.error('ReviewSummary: Invalid containerElement passed to onMount:', containerElement);
        return;
    }
    console.log('ReviewSummary: Container validated, proceeding with initialization');

    // Track product page view (review summary activation)
    this.trackPageView();

    const responseArea = containerElement.querySelector('.summary-response-area');
    const summaryContentElement = responseArea?.querySelector('.ai-summary-content');
    const attributionElement = responseArea?.querySelector('.summary-attribution');

    if (!responseArea || !summaryContentElement || !attributionElement) {
      console.error('ReviewSummary: Missing required elements.');
      // Keep essential error logs
      if(!responseArea) console.error('>>> ReviewSummary: responseArea missing');
      if(!summaryContentElement) console.error('>>> ReviewSummary: summaryContentElement missing');
      if(!attributionElement) console.error('>>> ReviewSummary: attributionElement missing');
      
      // Still show the block with an error message instead of hiding it
      containerElement.classList.add('visible');
      containerElement.classList.add('loaded');
      if (summaryContentElement) {
        summaryContentElement.textContent = 'Configuration error. Reach out to info@shop-ai.co to resolve any issues.';
        if (responseArea) responseArea.classList.add('error');
      }
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

    // Always show the block, but handle no reviews case
    containerElement.classList.add('visible'); // Make the container visible via CSS class
    summaryContentElement.textContent = ''; // Clear previous content
    responseArea.classList.remove('error');
    attributionElement.classList.add('hidden');

    if (!scrapedReviews) {
        // Check for star ratings as fallback
        console.log('ReviewSummary: No review text found, checking for star ratings...');
        const starRatingInfo = this.getStarRatingInfo();
        
        if (starRatingInfo) {
            console.log('ReviewSummary: Found star rating info:', starRatingInfo);
            summaryContentElement.textContent = starRatingInfo;
            responseArea.classList.remove('loading');
            responseArea.classList.remove('error');
            containerElement.classList.add('loaded');
            attributionElement.classList.remove('hidden');
            
            // Use TextGenerateEffect if available
            if (window.TextGenerateEffect) {
              TextGenerateEffect.animateText(summaryContentElement, starRatingInfo, {
                duration: 0.6,
                staggerDelay: 0.08,
                filter: true
              });
            }
            return;
        }
        
        // Show error message when no reviews or ratings are detected
        console.log('ReviewSummary: No reviews or ratings found, showing error message.');
        summaryContentElement.textContent = 'No reviews detected. Reach out to info@shop-ai.co to resolve any issues.';
        responseArea.classList.add('error');
        containerElement.classList.add('loaded');
        return;
    }

    // --- Reviews found, fetch summary --- 
    console.log(">>> ReviewSummary: Elements Check:", { containerElement, summaryContentElement, responseArea, attributionElement }); // Log elements
    responseArea.classList.add('loading'); // Show loading state

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

      // --- Apply TextGenerateEffect animation if no error ---
      if (!responseArea.classList.contains('error')) {
        // Use TextGenerateEffect for animation
        if (window.TextGenerateEffect) {
          TextGenerateEffect.animateText(summaryContentElement, summaryText, {
            duration: 0.6,
            staggerDelay: 0.1,
            filter: true
          });
        } else {
          // Fallback if TextGenerateEffect isn't loaded
          summaryContentElement.textContent = summaryText;
        }
        attributionElement.classList.remove('hidden');
      } else {
        // For error cases, just set text directly
        summaryContentElement.textContent = summaryText;
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
    console.log('ReviewSummary: DOMContentLoaded event fired - looking for review blocks.');
    const blocks = document.querySelectorAll('#review-summary-block:not([data-initialized="true"])');
    console.log('ReviewSummary: Found blocks:', blocks.length);
    blocks.forEach(container => {
        console.log('ReviewSummary: Initializing component via DOMContentLoaded for block:', container);
        ReviewSummary.onMount(container);
        container.dataset.initialized = 'true';
    });
}); 