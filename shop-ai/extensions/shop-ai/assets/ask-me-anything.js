const AskMeAnything = {
  onMount(containerElement = document) {
    console.log('AskMeAnything: onMount called for container:', containerElement);
    if (!containerElement || containerElement.id !== 'ask-me-anything') {
        console.error('AskMeAnything: Invalid containerElement passed to onMount:', containerElement);
        return;
    }

    const searchInput = containerElement.querySelector('.search-input');
    const responseArea = containerElement.querySelector('.response-area');
    const productContext = containerElement.dataset.productContext;

    if (!searchInput || !responseArea || !productContext) {
      console.error('AskMeAnything: Missing required elements or product context.');
      if(!searchInput) console.error('>>> searchInput missing');
      if(!responseArea) console.error('>>> responseArea missing');
      if(!productContext) console.error('>>> productContext missing');
      if (responseArea) {
          responseArea.textContent = 'Error: Could not initialize component.';
          responseArea.style.display = 'block';
          responseArea.className = 'response-area error';
      }
      return;
    }
    console.log('AskMeAnything: Found elements and context.');

    // Add focus effects
    searchInput.addEventListener('focus', () => {
      searchInput.closest('.search-wrapper').style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    });

    searchInput.addEventListener('blur', () => {
      searchInput.closest('.search-wrapper').style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
    });

    // Handle input changes
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      // TODO: Implement search functionality (maybe with debouncing if needed later)
    });

    // Handle form submission
    searchInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) {
           return;
        }

        // --- Show Loading State ---
        // responseArea.textContent = 'Thinking...';
        // responseArea.classList.remove('error');
        // responseArea.classList.add('loading');
        // responseArea.classList.add('visible'); 
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
              productContext: productContext,
            }),
          });

          const result = await response.json();

          // --- Display Result or Error ---
           if (!response.ok || result.error) {
             // Attempt to get a more specific error from Shopify's proxy response if it's not JSON
             let errorMessage = result.error || `API Error: ${response.statusText}`;
             if (!response.ok && response.headers.get('content-type')?.includes('text/html')) {
                // If Shopify returned an HTML error page via the proxy
                errorMessage = `App Proxy Error ${response.status}: Check backend server or proxy config.`;
                console.error("Received HTML error page from App Proxy.");
             } else if (result.error) {
                console.error('AskMeAnything: API Error (JSON):', result);
             } else {
                console.error(`AskMeAnything: API Error (Status ${response.status}):`, response.statusText);
             }
             responseArea.textContent = `Error: ${errorMessage}`;
             responseArea.classList.remove('loading'); // Still remove just in case
             responseArea.classList.add('error');
             responseArea.classList.add('visible'); // Add visible here
           } else {
             console.log('AskMeAnything: API Success, displaying answer.');
             responseArea.textContent = result.answer;
             responseArea.classList.remove('loading'); // Still remove just in case
             responseArea.classList.remove('error');
             responseArea.classList.add('visible'); // Add visible here
           }

        } catch (error) {
           // Handle JSON parsing errors specifically, often caused by non-JSON responses (like HTML 404s)
           if (error instanceof SyntaxError) {
               console.error('AskMeAnything: Fetch Error - Failed to parse JSON response:', error);
               responseArea.textContent = 'Error: Received an invalid response from the server.';
           } else {
               console.error('AskMeAnything: Fetch Error:', error);
               responseArea.textContent = 'Error: Could not connect to the server.';
           }
           responseArea.classList.remove('loading'); // Still remove just in case
           responseArea.classList.add('error');
           responseArea.classList.add('visible'); // Add visible here
        } finally {
          console.log('AskMeAnything: Re-enabling input.');
          searchInput.disabled = false;
          searchInput.focus();
        }
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