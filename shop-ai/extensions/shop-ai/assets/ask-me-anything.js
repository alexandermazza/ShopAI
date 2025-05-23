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

  // --- Helper to fetch reviews from Judge.me API ---
  async fetchJudgeMeReviews(productId, productUrl) {
    console.log(`AskMeAnything: Fetching ALL Judge.me reviews via API for product ${productId}`);
    if (!productId || !productUrl) {
      console.error("AskMeAnything: Missing productId or productUrl for API call.");
      return "\nCustomer Reviews: Could not fetch reviews (missing product info).\n";
    }

    const apiUrlBase = 'https://judge.me/api/v1/reviews'; // Use the v1 API endpoint
    const shopDomain = window.location.hostname; // Get shop domain dynamically
    const perPage = 5; // Fetch 5 reviews per page
    let allReviews = [];
    let currentPage = 1;
    let totalReviewsFetched = 0;
    let reviewsText = '\nCustomer Reviews:\n';

    try {
      // Loop indefinitely until explicitly broken
      while (true) {
        // Construct the API URL for the v1 endpoint
        const apiUrl = `${apiUrlBase}?api_token=${window.Shopify?.shop}&shop_domain=${shopDomain}&handle=${productUrl.split('/').pop()}&per_page=${perPage}&page=${currentPage}`;
        // Note: Judge.me API v1 might require api_token and shop_domain. If this doesn't work,
        // we might need to adjust authentication or fall back to the widget endpoint if it's still accessible.
        // The original request mentioned 'reviews_for_widget', which might be different.
        // Let's try the documented v1 endpoint first.

        console.log(`AskMeAnything: Fetching page ${currentPage} from ${apiUrl}`);

        const response = await fetch(apiUrl);

        if (!response.ok) {
          console.error(`AskMeAnything: Judge.me API request failed with status ${response.status}`);
          // Try to get error message if available
          let errorMsg = `API Error (${response.status})`;
          try {
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg;
          } catch (e) { /* Ignore if response is not JSON */ }
          reviewsText += ` - Error fetching reviews: ${errorMsg}\n`;
          break; // Stop fetching on error
        }

        const data = await response.json();

        // --- Parse V1 API Response --- 
        if (!data.reviews || data.reviews.length === 0) {
           console.log(`AskMeAnything: No more reviews found on page ${currentPage}. Stopping fetch.`);
           break; // Exit loop if no reviews are returned
        }

        data.reviews.forEach(review => {
            const rating = review.rating || '?';
            const title = review.title || '';
            const body = review.body || 'No comment';
            const author = review.reviewer?.name || 'Anonymous'; // Adjust based on actual API response structure
            
            allReviews.push({
                rating,
                author,
                title,
                body
            });
            totalReviewsFetched++;
        });

        console.log(`AskMeAnything: Fetched ${data.reviews.length} reviews from page ${currentPage}. Total fetched: ${totalReviewsFetched}`);

        currentPage++;

        // Add a polite delay between requests
        await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
      }

    } catch (error) {
      console.error('AskMeAnything: Error fetching or processing Judge.me API reviews:', error);
      reviewsText += ' - Error fetching reviews. Please try again later.\n';
      // Return immediately with error message if fetch itself fails
      return reviewsText;
    }

    // --- Format the fetched reviews --- 
    if (allReviews.length === 0) {
      console.log("AskMeAnything: No reviews fetched from the API.");
      return "\nCustomer Reviews: No reviews found.\n";
    }

    allReviews.forEach((r, i) => {
      reviewsText += `- Review ${i + 1}: Rating: ${r.rating}/5. ${r.author ? 'By: ' + r.author + '. ' : ''}${r.title ? 'Title: \"' + r.title + '\". ' : ''}Comment: "${r.body}"\n`;
    });

    console.log(`AskMeAnything: Successfully formatted ${allReviews.length} reviews from API.`);
    return reviewsText;
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
    const productId = containerElement.dataset.productId;
    const productUrl = containerElement.dataset.productUrl;

    if (!searchInput || !responseArea || !answerContentElement || !attributionElement || !productContext || !productId || !productUrl) {
      console.error('AskMeAnything: Missing required elements, product context, ID, or URL.');
      if(!searchInput) console.error('>>> searchInput missing');
      if(!responseArea) console.error('>>> responseArea missing');
      if(!answerContentElement) console.error('>>> answerContentElement missing');
      if(!attributionElement) console.error('>>> attributionElement missing');
      if(!productContext) console.error('>>> productContext missing');
      if(!productId) console.error('>>> productId missing');
      if(!productUrl) console.error('>>> productUrl missing');
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

      // --- Fetch review content from Judge.me API --- 
      const fetchedReviews = await this.fetchJudgeMeReviews(productId, productUrl);
      const combinedContext = `${productContext}\n${fetchedReviews}`;

      // --- Show Loading State & Clear Previous Answer ---
      answerContentElement.textContent = ''; // Clear previous answer immediately
      responseArea.classList.remove('error');
      responseArea.classList.add('loading'); // Keep loading state for now
      responseArea.classList.add('visible');
      attributionElement.classList.add('hidden');
      searchInput.disabled = true;

      // Use the App Proxy path
      const apiUrl = '/apps/proxy/resource-openai';
      const language = containerElement.getAttribute('data-language') || 'en';
      console.log(`AskMeAnything: Calling API via App Proxy (streaming): ${apiUrl}`);

      try {
        // --- Call Backend API ---
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question: query,
            productContext: combinedContext,
            language // send selected language
          }),
        });

        // --- Check Response Status ---
        if (!response.ok) {
          let errorMessage = `API Error: ${response.status} ${response.statusText}`;
          try {
            const errorText = await response.text();
            if (errorText.startsWith('Error:')) {
                errorMessage = errorText;
            } else if (response.headers.get('content-type')?.includes('text/html')) {
                 errorMessage = `App Proxy Error ${response.status}: Check backend server or proxy config.`;
                 console.error("Received HTML error page from App Proxy.");
            } else {
                 console.warn("Received non-HTML, non-standard error response body:", errorText);
            }
          } catch (readError) {
            console.error('AskMeAnything: Failed to read error response body:', readError);
          }
          throw new Error(errorMessage);
        }

        // --- Handle Streamed Response --- 
        if (!response.body) {
          throw new Error("Response body is null, cannot read stream.");
        }

        console.log('AskMeAnything: Receiving streamed response...');
        answerContentElement.textContent = ''; // Ensure it's clear before streaming starts
        responseArea.classList.remove('loading'); // Remove loading once stream starts

        // --- Stream and parse JSON if needed ---
        let fullResponse = '';
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          fullResponse += value;
        }
        // Try to parse as JSON and extract answer
        let answerText = fullResponse;
        try {
          const parsed = JSON.parse(fullResponse);
          if (parsed && parsed.answer) {
            answerText = parsed.answer;
          }
        } catch (e) {
          // Not JSON, fallback to raw text
        }
        answerContentElement.textContent = answerText;
        responseArea.classList.add('visible'); 
        attributionElement.classList.remove('hidden');

      } catch (error) {
        console.error('AskMeAnything: Error during fetch or streaming:', error);
        answerContentElement.textContent = `Error: ${error.message || 'An unexpected error occurred.'}`;
        responseArea.classList.remove('loading');
        responseArea.classList.add('error', 'visible');
        attributionElement.classList.remove('hidden'); 
      } finally {
        searchInput.disabled = false;
        searchInput.focus();
      }
    });

    // --- AI Suggested Questions Feature ---
    const suggestionsContainer = containerElement.querySelector('#suggested-questions-container');
    if (suggestionsContainer && productContext) {
      suggestionsContainer.innerHTML = '<span class="loading-message">Loading suggestions...</span>';
      fetch('/apps/proxy/resource-openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'getSuggestedQuestions',
          productContext
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.suggestedQuestions && Array.isArray(data.suggestedQuestions) && data.suggestedQuestions.length > 0) {
          suggestionsContainer.innerHTML = '';
          data.suggestedQuestions.forEach(q => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'suggested-question-button';
            btn.textContent = q;
            btn.onclick = () => {
              searchInput.value = q;
              form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            };
            suggestionsContainer.appendChild(btn);
          });
        } else {
          suggestionsContainer.innerHTML = '';
        }
      })
      .catch(() => {
        suggestionsContainer.innerHTML = '';
      });
    }
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