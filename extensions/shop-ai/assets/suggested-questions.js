console.log('suggested-questions.js loaded');

const SuggestedQuestions = {
  async waitForJudgeMeReviews(maxWaitMs = 20000) {
    let reviews = document.querySelectorAll('.jdgm-rev');
    if (reviews.length > 0) return reviews;
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
  async scrapeReviewContent() {
    let reviewText = '\nCustomer Reviews:\n';
    let reviews = [];
    const judgeMeReviews = await this.waitForJudgeMeReviews();
    if (judgeMeReviews.length > 0) {
      judgeMeReviews.forEach((reviewElement, index) => {
        if (index >= 5) return;
        const ratingElement = reviewElement.querySelector('.jdgm-rev__rating');
        const authorElement = reviewElement.querySelector('.jdgm-rev__author');
        let bodyText = '';
        const bodyP = reviewElement.querySelector('.jdgm-rev__body p');
        const bodyDiv = reviewElement.querySelector('.jdgm-rev__body');
        if (bodyP && bodyP.textContent.trim()) bodyText = bodyP.textContent.trim();
        else if (bodyDiv && bodyDiv.textContent.trim()) bodyText = bodyDiv.textContent.trim();
        else bodyText = 'Review Text Missing';
        const rating = ratingElement ? (ratingElement.getAttribute('data-score') || ratingElement.textContent.trim() || '?') : '?';
        const author = authorElement ? authorElement.textContent.trim().replace(/\s+/g, ' ') : '';
        reviews.push({ rating, author, body: bodyText });
      });
    } else {
      let nativeReviews = document.querySelectorAll('.spr-review');
      if (nativeReviews.length === 0) nativeReviews = document.querySelectorAll('.shopify-product-reviews .review');
      if (nativeReviews.length > 0) {
        nativeReviews.forEach((reviewElement, index) => {
          if (index >= 5) return;
          const ratingElement = reviewElement.querySelector('.spr-review-rating, .review-rating');
          const authorElement = reviewElement.querySelector('.spr-review-author, .review-author');
          const bodyElement = reviewElement.querySelector('.spr-review-content, .review-content');
          const rating = ratingElement ? ratingElement.textContent.trim().replace(/\s+/g, ' ') : '?';
          const author = authorElement ? authorElement.textContent.trim().replace(/\s+/g, ' ') : '';
          const body = bodyElement ? bodyElement.textContent.trim().replace(/\s+/g, ' ') : 'Review Text Missing';
          reviews.push({ rating, author, body });
        });
      }
    }
    if (reviews.length === 0) return "\nCustomer Reviews: No reviews found on this page.\n";
    reviews.forEach((r, i) => {
      reviewText += `- Review ${i + 1}: Rating: ${r.rating}/5. ${r.author ? 'By: ' + r.author + '. ' : ''}Comment: "${r.body}"\n`;
    });
    return reviewText;
  },
  async waitForContextAndReviews(container, timeout = 15000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      function check() {
        const ctx = container.dataset.productContext;
        const reviews = document.querySelectorAll('.jdgm-rev, .spr-review, .shopify-product-reviews .review');
        if (ctx && ctx.trim().length > 0 && reviews.length > 0) {
          resolve({ ctx, reviews });
        } else if (Date.now() - start > timeout) {
          reject(new Error('Timed out waiting for productContext and reviews'));
        } else {
          setTimeout(check, 250);
        }
      }
      check();
    });
  },
  async onMount(containerElement = document) {
    console.log('SuggestedQuestions: onMount called for', containerElement);
    const suggestionsContainer = containerElement.querySelector('#suggested-questions-container');
    console.log('SuggestedQuestions: suggestionsContainer:', suggestionsContainer);
    if (!suggestionsContainer) return;

    const language = containerElement.getAttribute('data-language') || 'en'; // Get language

    suggestionsContainer.innerHTML = '<span class="loading-message">Loading suggestions...</span>';
    try {
      const { ctx } = await this.waitForContextAndReviews(containerElement);
      console.log('SuggestedQuestions: context ready:', ctx);
      const scrapedReviews = await this.scrapeReviewContent();
      const combinedContext = `${ctx}\\n${scrapedReviews}`;
      console.log('SuggestedQuestions: combinedContext (full):', combinedContext);

      console.log('SuggestedQuestions: Combined context length:', combinedContext.length);
      console.log('SuggestedQuestions: Language:', language);

      const res = await fetch('/apps/proxy/resource-openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'getSuggestedQuestions',
          productContext: combinedContext,
          language: language
        })
      });
      console.log('SuggestedQuestions: API response status:', res.status);
      if (!res.ok) {
        const text = await res.text();
        suggestionsContainer.innerHTML = '<span class="error-message">Could not load suggestions.</span>';
        console.log('SuggestedQuestions: API error body:', text);
        return;
      }
      const data = await res.json();
      console.log('SuggestedQuestions: API data:', data);

      if (data.suggestions && data.suggestions.questions && Array.isArray(data.suggestions.questions) && data.suggestions.questions.length > 0) {
        suggestionsContainer.innerHTML = '';
        data.suggestions.questions.forEach(q => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'suggested-question-button';
          btn.textContent = q;
          btn.onclick = () => {
            const searchInput = containerElement.querySelector('.search-input');
            const form = containerElement.querySelector('form.ask-me-anything-form');
            if (searchInput && form) {
              searchInput.value = q;
              form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
          };
          suggestionsContainer.appendChild(btn);
        });
        console.log('SuggestedQuestions: rendered buttons:', data.suggestions.questions.length);
      } else {
        suggestionsContainer.innerHTML = '<span class="no-suggestions-message">No suggested questions found.</span>';
        console.log('SuggestedQuestions: No suggested questions found.');
      }
    } catch (err) {
      suggestionsContainer.innerHTML = '<span class="error-message">Could not load suggestions (context or reviews missing).</span>';
      console.log('SuggestedQuestions: error:', err);
    }
  }
};

window.SuggestedQuestions = SuggestedQuestions;

document.addEventListener('shopify:section:load', function(event) {
  const sectionId = event.detail.sectionId;
  const sectionElement = document.getElementById(`shopify-section-${sectionId}`);
  if (!sectionElement) return;
  const container = sectionElement.querySelector(`#ask-me-anything`);
  if (container) {
    SuggestedQuestions.onMount(container);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#ask-me-anything').forEach(container => {
    SuggestedQuestions.onMount(container);
  });
}); 