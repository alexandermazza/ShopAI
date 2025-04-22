const AskMeAnything = {
  // --- Helper to wait for Judge.me reviews to appear ---
  async waitForJudgeMeReviews(maxWaitMs = 20000) {
    // Try immediately
    let reviews = document.querySelectorAll('.jdgm-rev');
    if (reviews.length > 0) {
      console.log('AskMeAnything: Found .jdgm-rev reviews immediately:', reviews.length);
      return reviews;
    }
    // Set up observer
    return new Promise(resolve => {
      let found = false;
      const observer = new MutationObserver(() => {
        const reviewsNow = document.querySelectorAll('.jdgm-rev');
        if (reviewsNow.length > 0) {
          found = true;
          console.log('AskMeAnything: MutationObserver found .jdgm-rev reviews:', reviewsNow.length);
          observer.disconnect();
          resolve(reviewsNow);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        if (!found) {
          observer.disconnect();
          const reviewsNow = document.querySelectorAll('.jdgm-rev');
          console.log('AskMeAnything: Timeout, found .jdgm-rev reviews:', reviewsNow.length);
          resolve(reviewsNow);
        }
      }, maxWaitMs);
    });
  },

  // --- Helper Function to Scrape Reviews ---
  async scrapeReviewContent() {
    console.log("AskMeAnything: Attempting to scrape review content from DOM.");
    let reviewText = '\nCustomer Reviews:\n';
    let reviews = [];

    // Use robust waiting logic for Judge.me reviews
    const judgeMeReviews = await this.waitForJudgeMeReviews();
    if (judgeMeReviews.length > 0) {
      console.log(`AskMeAnything: Processing ${judgeMeReviews.length} Judge.me review elements.`);
      judgeMeReviews.forEach((reviewElement, index) => {
        if (index >= 5) return; // Limit to 5 reviews
        const ratingElement = reviewElement.querySelector('.jdgm-rev__rating');
        const authorElement = reviewElement.querySelector('.jdgm-rev__author');
        // Try to get the <p> inside .jdgm-rev__body, fallback to .jdgm-rev__body text
        let bodyText = '';
        const bodyP = reviewElement.querySelector('.jdgm-rev__body p');
        const bodyDiv = reviewElement.querySelector('.jdgm-rev__body');
        if (bodyP && bodyP.textContent.trim()) {
          bodyText = bodyP.textContent.trim();
          console.log(`AskMeAnything: Review #${index+1} - Found body <p>:`, bodyText);
        } else if (bodyDiv && bodyDiv.textContent.trim()) {
          bodyText = bodyDiv.textContent.trim();
          console.log(`AskMeAnything: Review #${index+1} - Found body div:`, bodyText);
        } else {
          bodyText = 'Review Text Missing';
          console.log(`AskMeAnything: Review #${index+1} - No review body found.`);
        }
        const rating = ratingElement ? (ratingElement.getAttribute('data-score') || ratingElement.textContent.trim() || '?') : '?';
        const author = authorElement ? authorElement.textContent.trim().replace(/\s+/g, ' ') : '';
        reviews.push({
          rating,
          author,
          body: bodyText
        });
      });
    } else {
      // Try native Shopify reviews (example selectors, adjust as needed)
      let nativeReviews = document.querySelectorAll('.spr-review');
      if (nativeReviews.length === 0) {
        // Try another common selector
        nativeReviews = document.querySelectorAll('.shopify-product-reviews .review');
      }
      if (nativeReviews.length > 0) {
        console.log(`AskMeAnything: Found ${nativeReviews.length} native Shopify review elements.`);
        nativeReviews.forEach((reviewElement, index) => {
          if (index >= 5) return;
          const ratingElement = reviewElement.querySelector('.spr-review-rating, .review-rating');
          const authorElement = reviewElement.querySelector('.spr-review-author, .review-author');
          const bodyElement = reviewElement.querySelector('.spr-review-content, .review-content');
          const rating = ratingElement ? ratingElement.textContent.trim().replace(/\s+/g, ' ') : '?';
          const author = authorElement ? authorElement.textContent.trim().replace(/\s+/g, ' ') : '';
          const body = bodyElement ? bodyElement.textContent.trim().replace(/\s+/g, ' ') : 'Review Text Missing';
          reviews.push({
            rating,
            author,
            body
          });
        });
      }
    }
    if (reviews.length === 0) {
      console.log("AskMeAnything: No review content scraped from the page.");
      return "\nCustomer Reviews: No reviews found on this page.\n";
    }
    reviews.forEach((r, i) => {
      reviewText += `- Review ${i + 1}: Rating: ${r.rating}/5. ${r.author ? 'By: ' + r.author + '. ' : ''}Comment: \"${r.body}\"\n`;
    });
    console.log(`AskMeAnything: Scraped ${reviews.length} reviews.`);
    return reviewText;
  },

  onMount(containerElement = document) {
    console.log('AskMeAnything: onMount called for container:', containerElement);
    if (!containerElement || containerElement.id !== 'ask-me-anything') {
        console.error('AskMeAnything: Invalid containerElement passed to onMount:', containerElement);
        return;
    }

    const searchInput = containerElement.querySelector('.search-input');
    const responseArea = containerElement.querySelector('.response-area');
    const answerContentElement = responseArea?.querySelector('.ai-answer-content');
    const attributionElement = responseArea?.querySelector('#powered-by-attribution');
    const productContext = containerElement.dataset.productContext;

    if (!searchInput || !responseArea || !answerContentElement || !attributionElement || !productContext) {
      console.error('AskMeAnything: Missing required elements or product context.');
      if(!searchInput) console.error('>>> searchInput missing');
      if(!responseArea) console.error('>>> responseArea missing');
      if(!answerContentElement) console.error('>>> answerContentElement missing');
      if(!attributionElement) console.error('>>> attributionElement missing');
      if(!productContext) console.error('>>> productContext missing');
      if (responseArea) {
          responseArea.textContent = 'Error: Could not initialize component.';
          responseArea.style.display = 'block';
          responseArea.className = 'response-area error';
      }
      return;
    }
    console.log('AskMeAnything: Found elements and context.');

    const form = containerElement.querySelector('form.ask-me-anything-form');
    // Remove keypress handler and use form submit instead
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = searchInput.value.trim();
      if (!query) {
        return;
      }

      // --- Scrape review content just before sending ---
      const scrapedReviews = await this.scrapeReviewContent(); // Now async
      const combinedContext = `${productContext}\n${scrapedReviews}`;

      // --- Show Loading State ---
      answerContentElement.textContent = 'Thinking...';
      responseArea.classList.remove('error');
      responseArea.classList.add('loading');
      responseArea.classList.add('visible');
      attributionElement.classList.add('hidden');
      searchInput.disabled = true;

      // Use the App Proxy path
      const apiUrl = '/apps/proxy/resource-openai'; 
      console.log(`AskMeAnything: Calling API via App Proxy: ${apiUrl}`); 

      try {
        // --- Call Backend API ---
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: query,
            productContext: combinedContext, // Send combined context
          }),
        });

        // --- Check Response Status BEFORE Parsing JSON ---
        if (!response.ok) {
          let errorMessage = `API Error: ${response.status} ${response.statusText}`;
          // Check if the error response is HTML (likely a server error page)
          if (response.headers.get('content-type')?.includes('text/html')) {
            errorMessage = `App Proxy Error ${response.status}: Check backend server or proxy config.`;
            console.error("Received HTML error page from App Proxy.");
          } else {
            // Try to parse as JSON in case the error response IS JSON
            try {
              const errorResult = await response.json();
              errorMessage = errorResult.error || errorMessage;
              console.error('AskMeAnything: API Error (JSON Response):', errorResult);
            } catch (parseError) {
               // Only log parse error if we didn't already identify it as HTML
               if (!response.headers.get('content-type')?.includes('text/html')) {
                  console.error('AskMeAnything: Failed to parse non-HTML error response body:', parseError);
               }
               // Keep the original errorMessage based on status
            }
          }
          // Throw an error to be caught by the catch block below
          throw new Error(errorMessage);
        }

        // --- If response.ok, Parse JSON and Display Result ---
        const result = await response.json();

        if (result.error) {
           console.error('AskMeAnything: API Error (JSON Payload):', result);
           // Throw error to be caught below
           throw new Error(result.error);
        } else {
           console.log('AskMeAnything: API Success, displaying answer.');
           answerContentElement.textContent = result.answer;
           responseArea.classList.remove('loading', 'error');
           responseArea.classList.add('visible');
           attributionElement.classList.remove('hidden');
        }

      } catch (error) {
         console.error('AskMeAnything: Error during fetch or processing:', error);
         // Display the error message (could be from thrown Error or network/parse error)
         answerContentElement.textContent = `Error: ${error.message || 'An unexpected error occurred.'}`;
         responseArea.classList.remove('loading');
         responseArea.classList.add('error', 'visible');
         attributionElement.classList.remove('hidden');
      } finally {
         console.log('AskMeAnything: Re-enabling input.');
         searchInput.disabled = false;
         searchInput.focus();
      }
    });
  }
};

// Register the block
window.AskMeAnything = AskMeAnything;

// More Robust Initialization using Shopify Events
document.addEventListener('shopify:section:load', function(event) {
  console.log('AskMeAnything: shopify:section:load event fired.');
  const sectionId = event.detail.sectionId;
  const sectionElement = document.getElementById(`shopify-section-${sectionId}`);
  if (!sectionElement) {
     console.log('AskMeAnything: Section element not found for ID:', sectionId);
     return;
  }
  const container = sectionElement.querySelector(`#ask-me-anything`);

  if (container && container.dataset.initialized !== 'true') {
    console.log('AskMeAnything: Initializing component via section:load.');
    AskMeAnything.onMount(container);
    container.dataset.initialized = 'true';
  } else if (container) {
      console.log('AskMeAnything: Component already initialized (section:load).');
  } else {
      console.log('AskMeAnything: Container #ask-me-anything not found in loaded section.');
  }
});

// Handle initial load for sections already present
document.addEventListener('DOMContentLoaded', () => {
    console.log('AskMeAnything: DOMContentLoaded event fired.');
    document.querySelectorAll('#ask-me-anything:not([data-initialized="true"])').forEach(container => {
        console.log('AskMeAnything: Initializing component via DOMContentLoaded.');
        AskMeAnything.onMount(container);
        container.dataset.initialized = 'true';
    });
}); 