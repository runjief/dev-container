/**
 * Shadow DOM Event Bridge
 * 
 * This function creates an event bridge between the shadow DOM iframe 
 * and the parent document iframe to ensure events propagate correctly.
 */
export function createShadowDomBridge(iframe, shadowIframe) {
    if (!iframe || !shadowIframe) return null;
    
    console.log('[MFE] Creating shadow DOM event bridge');
    
    // Forward messages from shadow iframe to original iframe
    const shadowHandler = (event) => {
      if (event.source !== shadowIframe.contentWindow) return;
      
      console.log('[MFE] Shadow iframe -> Parent:', event.data);
      
      // Forward to parent window
      window.postMessage(event.data, '*');
      
      // Also forward to the original iframe if it's different
      if (iframe.contentWindow && iframe.contentWindow !== event.source) {
        iframe.contentWindow.postMessage(event.data, '*');
      }
    };
    
    // Forward messages from original iframe to shadow iframe
    const originalHandler = (event) => {
      if (event.source !== iframe.contentWindow) return;
      
      console.log('[MFE] Original iframe -> Shadow:', event.data);
      
      // Forward to shadow iframe
      if (shadowIframe.contentWindow) {
        shadowIframe.contentWindow.postMessage(event.data, '*');
      }
    };
    
    // Forward messages from parent to both iframes
    const parentHandler = (event) => {
      if (event.source !== window) return;
      
      // Only process MFE-related messages
      if (!event.data || !event.data.type || !event.data.type.startsWith('mfe-')) return;
      
      console.log('[MFE] Parent -> Both iframes:', event.data);
      
      // Forward to both iframes
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(event.data, '*');
      }
      
      if (shadowIframe.contentWindow) {
        shadowIframe.contentWindow.postMessage(event.data, '*');
      }
    };
    
    // Set up listeners
    window.addEventListener('message', shadowHandler);
    window.addEventListener('message', originalHandler);
    window.addEventListener('message', parentHandler);
    
    // Return function to remove listeners
    return () => {
      window.removeEventListener('message', shadowHandler);
      window.removeEventListener('message', originalHandler);
      window.removeEventListener('message', parentHandler);
    };
  }