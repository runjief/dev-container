// Updated main.js for Vue Child App
import { createApp } from 'vue';
import App from './App.vue';

// Wait for DOMContentLoaded to ensure the app element exists
document.addEventListener('DOMContentLoaded', () => {
  // Get or create the app element
  let appElement = document.getElementById('app');
  
  // If in MFE environment and no app element exists, create one
  if (!appElement && window.__POWERED_BY_MFE) {
    console.log('[Vue Child] Creating app element');
    appElement = document.createElement('div');
    appElement.id = 'app';
    appElement.style.cssText = 'width: 100%; height: 100%; overflow: auto;';
    document.body.appendChild(appElement);
    
    // Add base styles for proper rendering
    if (!document.getElementById('mfe-base-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'mfe-base-styles';
      styleEl.textContent = `
        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
          overflow: hidden;
        }
        #app {
          height: 100%;
          width: 100%;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }
  
  if (appElement) {
    const app = createApp(App);
    app.mount(appElement);
    
    // Signal to parent that component is rendered
    if (window.__POWERED_BY_MFE && window.parent) {
      window.parent.postMessage({ type: 'mfe-rendered', app: 'vue-child' }, '*');
    }
  } else {
    console.error('[Vue Child] Could not find or create app element');
  }
});

