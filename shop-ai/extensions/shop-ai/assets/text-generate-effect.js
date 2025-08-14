/**
 * Vanilla JavaScript implementation of Aceternity UI Text Generate Effect
 * Animates text by fading in words one by one with blur effect
 */

class TextGenerateEffect {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      duration: 0.2,
      staggerDelay: 0.03,
      filter: true,
      className: '',
      ...options
    };
    this.originalText = '';
    this.wordsArray = [];
    this.isAnimating = false;
  }

  // Initialize the effect with text
  init(text) {
    if (!text || typeof text !== 'string') return;
    
    this.originalText = text;
    this.wordsArray = text.split(' ');
    this.setupHTML();
  }

  // Create the HTML structure with individual word spans
  setupHTML() {
    if (!this.element) return;

    // Clear existing content
    this.element.innerHTML = '';
    
    // Create wrapper div
    const wrapper = document.createElement('div');
    wrapper.className = `text-generate-wrapper ${this.options.className}`;
    
    // Create individual spans for each word
    this.wordsArray.forEach((word, index) => {
      const span = document.createElement('span');
      span.className = 'text-generate-word';
      span.textContent = word;
      
      // Set initial styles
      span.style.opacity = '0';
      span.style.display = 'inline';
      span.style.transition = `opacity ${this.options.duration}s ease, filter ${this.options.duration}s ease`;
      
      if (this.options.filter) {
        span.style.filter = 'blur(10px)';
      }
      
      wrapper.appendChild(span);
      
      // Add space after each word except the last one
      if (index < this.wordsArray.length - 1) {
        const space = document.createTextNode(' ');
        wrapper.appendChild(space);
      }
    });
    
    this.element.appendChild(wrapper);
  }

  // Start the animation
  animate() {
    if (!this.element || this.isAnimating) return;
    
    this.isAnimating = true;
    const spans = this.element.querySelectorAll('.text-generate-word');
    
    if (spans.length === 0) return;

    // Animate each word with stagger delay
    spans.forEach((span, index) => {
      setTimeout(() => {
        span.style.opacity = '1';
        if (this.options.filter) {
          span.style.filter = 'blur(0px)';
        }
        
        // Mark animation as complete when last word animates
        if (index === spans.length - 1) {
          setTimeout(() => {
            this.isAnimating = false;
          }, this.options.duration * 1000);
        }
      }, index * this.options.staggerDelay * 1000);
    });
  }

  // Reset the animation (set all words back to initial state)
  reset() {
    if (!this.element) return;
    
    const spans = this.element.querySelectorAll('.text-generate-word');
    spans.forEach(span => {
      span.style.opacity = '0';
      if (this.options.filter) {
        span.style.filter = 'blur(10px)';
      }
    });
    this.isAnimating = false;
  }

  // Update text and optionally animate
  updateText(newText, animate = true) {
    this.init(newText);
    if (animate) {
      // Small delay to ensure DOM is updated
      setTimeout(() => this.animate(), 10);
    }
  }

  // Destroy the effect and restore original text
  destroy() {
    if (this.element) {
      this.element.innerHTML = this.originalText;
    }
    this.isAnimating = false;
  }
}

// Static method to create and immediately start animation
TextGenerateEffect.animateText = function(element, text, options = {}) {
  const effect = new TextGenerateEffect(element, options);
  effect.init(text);
  effect.animate();
  return effect;
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TextGenerateEffect;
} else {
  window.TextGenerateEffect = TextGenerateEffect;
} 