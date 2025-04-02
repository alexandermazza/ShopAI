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
      // TODO: Implement search functionality
      console.log('Search query:', query);
    });

    // Handle form submission
    searchInput.addEventListener('keypress', async (e) => {
      console.log(`AskMeAnything: keypress event detected - key: ${e.key}`);

      if (e.key === 'Enter') {
        console.log('AskMeAnything: Enter key pressed!');
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) {
           console.log('AskMeAnything: Query is empty, ignoring Enter.');
           return;
        }
        console.log(`AskMeAnything: Sending query "${query}"`);

        // --- Show Loading State ---
        responseArea.textContent = 'Thinking...';
        responseArea.style.display = 'block';
        responseArea.className = 'response-area loading';
        searchInput.disabled = true;

        try {
          // --- Call Backend API ---
          console.log('AskMeAnything: Calling /resource-openai');
          const response = await fetch('/resource-openai', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              question: query,
              productContext: productContext,
            }),
          });
          console.log(`AskMeAnything: API response status: ${response.status}`);

          const result = await response.json();

          // --- Display Result or Error ---
           if (!response.ok || result.error) {
             const errorMessage = result.error || `API Error: ${response.statusText}`;
             console.error('AskMeAnything: API Error:', result);
             responseArea.textContent = `Error: ${errorMessage}`;
             responseArea.className = 'response-area error';
           } else {
             console.log('AskMeAnything: API Success, displaying answer.');
             responseArea.textContent = result.answer;
             responseArea.className = 'response-area';
           }

        } catch (error) {
          console.error('AskMeAnything: Fetch Error:', error);
          responseArea.textContent = 'Error: Could not connect to the server.';
          responseArea.className = 'response-area error';
        } finally {
          console.log('AskMeAnything: Re-enabling input.');
          searchInput.disabled = false;
          searchInput.focus();
        }
      }
    });
    console.log('AskMeAnything: Keypress event listener added.');
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