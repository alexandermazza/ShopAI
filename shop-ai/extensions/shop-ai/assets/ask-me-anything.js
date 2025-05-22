const AskMeAnything = {
  // --- Helper to wait for Judge.me reviews to appear ---
  async waitForJudgeMeReviews(maxWaitMs = 20000) {
    // Try immediately
    let reviews = document.querySelectorAll('.jdgm-rev');
    if (reviews.length > 0) {
      return reviews;
    }
    // Set up observer
    return new Promise(resolve => {
      let found = false;
      const observer = new MutationObserver(() => {
        const reviewsNow = document.querySelectorAll('.jdgm-rev');
        if (reviewsNow.length > 0) {
          found = true;
          observer.disconnect();
          resolve(reviewsNow);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        if (!found) {
          observer.disconnect();
          const reviewsNow = document.querySelectorAll('.jdgm-rev');
          resolve(reviewsNow);
        }
      }, maxWaitMs);
    });
  },

  // --- Helper Function to Scrape Reviews ---
  async scrapeReviewContent() {
    let reviewText = '\nCustomer Reviews:\n';
    let reviews = [];

    // Use robust waiting logic for Judge.me reviews
    const judgeMeReviews = await this.waitForJudgeMeReviews();
    if (judgeMeReviews.length > 0) {
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
        } else if (bodyDiv && bodyDiv.textContent.trim()) {
          bodyText = bodyDiv.textContent.trim();
        } else {
          bodyText = 'Review Text Missing';
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
      return "\nCustomer Reviews: No reviews found on this page.\n";
    }
    reviews.forEach((r, i) => {
      reviewText += `- Review ${i + 1}: Rating: ${r.rating}/5. ${r.author ? 'By: ' + r.author + '. ' : ''}Comment: \"${r.body}\"\n`;
    });
    return reviewText;
  },

  // --- Helper to fetch reviews from Judge.me API ---
  async fetchJudgeMeReviews(productId, productUrl) {
    if (!productId || !productUrl) {
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

        const response = await fetch(apiUrl);

        if (!response.ok) {
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

        currentPage++;

        // Add a polite delay between requests
        await new Promise(resolve => setTimeout(resolve, 300)); // 300ms delay
      }

    } catch (error) {
      reviewsText += ' - Error fetching reviews. Please try again later.\n';
      // Return immediately with error message if fetch itself fails
      return reviewsText;
    }

    // --- Format the fetched reviews --- 
    if (allReviews.length === 0) {
      return "\nCustomer Reviews: No reviews found.\n";
    }

    allReviews.forEach((r, i) => {
      reviewsText += `- Review ${i + 1}: Rating: ${r.rating}/5. ${r.author ? 'By: ' + r.author + '. ' : ''}${r.title ? 'Title: \"' + r.title + '\". ' : ''}Comment: "${r.body}"\n`;
    });

    return reviewsText;
  },

  onMount(containerElement = document) {
    if (!containerElement || containerElement.id !== 'ask-me-anything') {
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
            // Attempt to parse as JSON for more structured error, fallback to text
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorJson.message || errorMessage;
            } catch (parseError) {
                errorMessage = errorText || errorMessage;
            }
          } catch (e) { /* Ignore if cannot read error text */ }

          answerContentElement.textContent = `Error: ${errorMessage}`;
          responseArea.classList.remove('loading');
          responseArea.classList.add('error');
          responseArea.classList.add('visible'); // Ensure it is visible to show error
          attributionElement.classList.add('hidden'); // Hide attribution on error
          return; // Exit early
        }

        // --- Stream or Process Full Response ---
        // Assuming your current backend sends a full JSON response:
        const data = await response.json();
        const answerText = data.answer || 'Sorry, I could not find an answer.';

        // --- Display Answer ---
        answerContentElement.textContent = ''; // Clear previous content
        answerContentElement.classList.remove('animate-text-reveal'); // Reset animation class

        // Force reflow to ensure the class removal is processed and animation can restart
        void answerContentElement.offsetWidth;

        // Setting text content before adding class (element is opacity: 0 due to base style)
        answerContentElement.textContent = answerText;
        
        responseArea.classList.remove('loading');
        responseArea.classList.remove('error'); // Ensure no error state
        responseArea.classList.add('visible'); // Make sure response area is visible
        answerContentElement.classList.add('animate-text-reveal'); // Trigger animation
        attributionElement.classList.remove('hidden');

      } catch (error) {
        answerContentElement.textContent = `Error: ${error.message || 'An unexpected error occurred.'}`;
        responseArea.classList.remove('loading');
        responseArea.classList.add('error', 'visible');
        attributionElement.classList.remove('hidden'); 
      } finally {
        searchInput.disabled = false;
        searchInput.focus();
      }
    });

    const clearButton = containerElement.querySelector('.clear-button');
    if (clearButton && searchInput) {
      searchInput.addEventListener('input', () => {
        clearButton.classList.toggle('hidden', !searchInput.value);
      });
      clearButton.addEventListener('click', () => {
        searchInput.value = '';
        clearButton.classList.add('hidden');
        searchInput.focus();
        // Optionally hide response area when cleared manually
        // responseArea.classList.remove('visible');
        // answerContentElement.textContent = '';
        // attributionElement.classList.add('hidden');
      });
    }

    // --- AI Suggested Questions Feature ---
    // (Moved to suggested-questions.js)
  }
};

// Register the block
window.AskMeAnything = AskMeAnything;

// More Robust Initialization using Shopify Events
document.addEventListener('shopify:section:load', function(event) {
  const sectionId = event.detail.sectionId;
  const sectionElement = document.getElementById(`shopify-section-${sectionId}`);
  if (!sectionElement) {
     return;
  }
  const container = sectionElement.querySelector(`#ask-me-anything`);

  if (container && container.dataset.initialized !== 'true') {
    AskMeAnything.onMount(container);
    container.dataset.initialized = 'true';
  } else if (container) {
  } else {
  }
});

// Handle initial load for sections already present
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#ask-me-anything:not([data-initialized="true"])').forEach(container => {
        AskMeAnything.onMount(container);
        container.dataset.initialized = 'true';
    });
}); 