/**
 * CORS-friendly fetch implementation
 * 
 * This is a wrapper around the native fetch API that adds CORS support
 * for cross-origin requests between parent and child applications.
 */

/**
 * Enhanced fetch with CORS support
 */
export function corsFetch(input, init = {}) {
    // Default options with CORS support
    const corsOptions = {
      mode: 'cors',
      credentials: 'include',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers
      }
    };
    
    return window.fetch(input, corsOptions);
  }
  
  /**
   * Helper to determine if a given URL is cross-origin
   */
  export function isCrossOrigin(url) {
    // If no URL provided or it's a relative URL, it's same origin
    if (!url || url.startsWith('/')) return false;
    
    try {
      const currentOrigin = window.location.origin;
      const targetOrigin = new URL(url, window.location.href).origin;
      
      return currentOrigin !== targetOrigin;
    } catch (error) {
      console.error('Error parsing URL:', error);
      return true; // Assume cross-origin if we can't parse the URL
    }
  }
  
  /**
   * Get absolute URL from relative path
   */
  export function getAbsoluteUrl(path, base) {
    try {
      return new URL(path, base || window.location.href).href;
    } catch (error) {
      console.error('Error creating absolute URL:', error);
      return path;
    }
  }
  
  /**
   * Creates a CORS-enabled fetch function for a specific application
   */
  export function createAppFetch(appUrl) {
    return function appFetch(input, init = {}) {
      // Convert relative URLs to absolute URLs based on the app URL
      const absoluteUrl = typeof input === 'string' && !input.startsWith('http') 
        ? getAbsoluteUrl(input, appUrl)
        : input;
      
      return corsFetch(absoluteUrl, init);
    };
  }