const AskMeAnything = {
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
    const clearButton = containerElement.querySelector('.clear-button');

    if (!searchInput || !responseArea || !answerContentElement || !attributionElement || !productContext || !clearButton) {
      console.error('AskMeAnything: Missing required elements or product context.');
      if(!searchInput) console.error('>>> searchInput missing');
      if(!responseArea) console.error('>>> responseArea missing');
      if(!answerContentElement) console.error('>>> answerContentElement missing');
      if(!attributionElement) console.error('>>> attributionElement missing');
      if(!productContext) console.error('>>> productContext missing');
      if(!clearButton) console.error('>>> clearButton missing');
      if (responseArea) {
          responseArea.textContent = 'Error: Could not initialize component.';
          responseArea.style.display = 'block';
          responseArea.className = 'response-area error';
      }
      return;
    }
    console.log('AskMeAnything: Found elements and context.');

    const form = containerElement.querySelector('.ask-me-anything-form');

    if (!form) {
      console.error('AskMeAnything: Missing form element.');
      if (responseArea) {
          responseArea.textContent = 'Error: Form element missing.';
          responseArea.style.display = 'block';
          responseArea.className = 'response-area error';
      }
      return;
    }

    // Add focus effects
    searchInput.addEventListener('focus', () => {
      searchInput.closest('.search-wrapper').style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    });

    searchInput.addEventListener('blur', () => {
      searchInput.closest('.search-wrapper').style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
    });

    // Handle input changes - Show/hide clear button
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      if (query.length > 0) {
        clearButton.classList.remove('hidden');
      } else {
        clearButton.classList.add('hidden');
      }
      // TODO: Implement search functionality (maybe with debouncing if needed later)
    });

    // Handle clear button click
    clearButton.addEventListener('click', () => {
      searchInput.value = '';
      // Manually trigger input event to hide the button
      searchInput.dispatchEvent(new Event('input', { bubbles: true })); 
      searchInput.focus(); // Keep focus on the input
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) {
           return;
        }

        // --- Wait for Reviews to Load ---
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second

        // --- Append Reviews to Product Context ---
        const reviews = [];
        const reviewSelectors = ['.jdgm-rev__body', '.loox-review-content', '.yotpo-review'];
        for (const selector of reviewSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            reviews.push(...Array.from(elements).slice(0, 3).map(el => el.innerText));
            break; // Stop checking once we find reviews
          }
        }
        console.log('Captured Reviews:', reviews); // Log captured reviews
        const reviewsText = reviews.length > 0 ? `\nCustomer Reviews:\n${reviews.join('\n')}` : '';
        const fullProductContext = `${productContext}${reviewsText}`;
        console.log('Full Product Context:', fullProductContext); // Log full product context

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
          const response = await fetch(apiUrl, { // <-- Use the App Proxy URL
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              question: query,
              productContext: fullProductContext,
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