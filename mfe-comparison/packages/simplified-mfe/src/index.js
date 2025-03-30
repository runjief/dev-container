/**
 * Simplified Micro-Frontend Framework based on Wujie
 * 
 * This framework implements core functionality from Wujie with minimal overhead
 * to enable accurate performance comparison between iframe and web component approaches.
 * 
 * Includes CORS support for cross-origin communication between applications.
 */

/**
 * Core module: event bus for communication between applications
 */
export class EventBus {
    constructor(id) {
      this.id = id;
      this.events = {};
      this.allEvents = [];
      
      // Get global event registry or create it
      if (!window.__MFE_EVENT_REGISTRY) {
        window.__MFE_EVENT_REGISTRY = new Map();
      }
      window.__MFE_EVENT_REGISTRY.set(this.id, this.events);
    }
  
    // Listen for a specific event
    $on(event, callback) {
      if (!this.events[event]) {
        this.events[event] = [];
      }
      if (!this.events[event].includes(callback)) {
        this.events[event].push(callback);
      }
      return this;
    }
  
    // Listen for all events
    $onAll(callback) {
      if (!this.allEvents.includes(callback)) {
        this.allEvents.push(callback);
      }
      return this;
    }
  
    // Remove event listener
    $off(event, callback) {
      if (this.events[event]) {
        const index = this.events[event].indexOf(callback);
        if (index !== -1) {
          this.events[event].splice(index, 1);
        }
      }
      return this;
    }
  
    // Remove "listen all" handler
    $offAll(callback) {
      const index = this.allEvents.indexOf(callback);
      if (index !== -1) {
        this.allEvents.splice(index, 1);
      }
      return this;
    }
  
    // Trigger an event
    $emit(event, ...args) {
      // Collect handlers from all registered event buses
      let handlers = [];
      let allHandlers = [];
      
      window.__MFE_EVENT_REGISTRY.forEach((events) => {
        if (events[event]) {
          handlers = handlers.concat(events[event]);
        }
        
        // Also collect "all event" handlers
        if (events['_all']) {
          allHandlers = allHandlers.concat(events['_all']);
        }
      });
      
      // Local handlers for this specific bus
      if (this.events[event]) {
        handlers = handlers.concat(this.events[event]);
      }
      
      // Add all event handlers
      allHandlers = allHandlers.concat(this.allEvents);
      
      // Execute handlers
      handlers.forEach(handler => handler(...args));
      allHandlers.forEach(handler => handler(event, ...args));
      
      return this;
    }
  
    // Clear all event listeners
    $clear() {
      this.events = {};
      this.allEvents = [];
      window.__MFE_EVENT_REGISTRY.set(this.id, this.events);
      return this;
    }
  }
  
  // Create a main event bus instance
  export const bus = new EventBus('main');
  
  /**
   * Core module: iframe sandboxing
   */
  class Sandbox {
    constructor(options) {
      const { name, url, container, fiber = true, degrade = false, fetch } = options;
      
      this.name = name;
      this.url = url;
      this.container = container;
      this.fiber = fiber;
      this.degrade = degrade;
      this.bus = new EventBus(name);
      this.iframe = null;
      this.shadowRoot = null;
      this.execQueue = [];
      this.mountFlag = false;
      this.unmountFlag = false;
      this.lifecycles = options.lifecycles || {};
      this.fetch = fetch || window.fetch;
  
      // Provide object for child app to access
      this.provide = {
        bus: this.bus,
        props: options.props || {},
        fetch: this.fetch
      };
    }
  
    /**
     * Create and load iframe
     */
    async createIframe() {
      // Create iframe
      const iframe = document.createElement('iframe');
      
      // Set attributes
      iframe.style.cssText = 'border: none; width: 100%; height: 100%;';
      if (this.degrade) {
        iframe.style.display = 'block';
      } else {
        iframe.style.display = 'none';
      }
      
      // Add CORS attributes to allow cross-origin communication
      iframe.setAttribute('allow', 'cross-origin-isolated');
      iframe.setAttribute('crossorigin', 'anonymous');
      iframe.setAttribute('data-mfe-id', this.name);
      
      // Enable cross-origin access
      iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-downloads');
      
      document.body.appendChild(iframe);
      
      this.iframe = iframe;
      
      // Prepare for iframe load
      return new Promise(resolve => {
        iframe.onload = () => {
          // Try to set up the iframe context
          try {
            // Check if we can access the contentWindow
            if (iframe.contentWindow) {
              // Set up messaging for cross-origin communication
              this.setupCrossOriginMessaging();
              
              // Show loading indicator
              this.showLoading(this.container);
              
              // Setup message handler for communication with iframe
              window.addEventListener('message', this.handleIframeMessage.bind(this));
              
              // Signal the iframe to initialize
              iframe.contentWindow.postMessage({
                type: 'mfe-init',
                id: this.name,
                props: this.provide.props
              }, '*');
            }
          } catch (e) {
            console.error('Error setting up iframe:', e);
          }
          
          this.hideLoading();
          resolve();
        };
        
        // Load URL
        iframe.src = this.url;
      });
    }
  
    /**
     * Setup cross-origin messaging with iframe
     */
    setupCrossOriginMessaging() {
      // Handle messages from iframe
      this.messageHandler = (event) => {
        // Only process messages from our iframe
        if (event.source !== this.iframe.contentWindow) return;
        
        const { type, event: eventName, payload } = event.data || {};
        
        if (type === 'mfe-event') {
          // Handle event emitted from child
          this.bus.$emit(eventName, ...(payload || []));
        } else if (type === 'mfe-mounted') {
          // Child app has mounted
          this.mountFlag = true;
        } else if (type === 'mfe-unmounted') {
          // Child app has unmounted
          this.unmountFlag = true;
        }
      };
      
      window.addEventListener('message', this.messageHandler);
      
      // Set up bus emission to use postMessage
      const originalEmit = this.bus.$emit;
      this.bus.$emit = (event, ...args) => {
        // Emit normally on parent side
        originalEmit.call(this.bus, event, ...args);
        
        // Also send to iframe
        if (this.iframe && this.iframe.contentWindow) {
          this.iframe.contentWindow.postMessage({
            type: 'mfe-event',
            event,
            payload: args
          }, '*');
        }
        
        return this.bus;
      };
    }
  
    /**
     * Handle messages from iframe
     */
    handleIframeMessage(event) {
      // Make sure the message is from our iframe
      if (event.source !== this.iframe.contentWindow) return;
      
      const { type, action } = event.data || {};
      
      if (type === 'mfe-lifecycle') {
        if (action === 'mounted') {
          this.mountFlag = true;
          if (this.lifecycles.afterMount) {
            this.lifecycles.afterMount(this.iframe.contentWindow);
          }
        } else if (action === 'unmounted') {
          this.unmountFlag = true;
          if (this.lifecycles.afterUnmount) {
            this.lifecycles.afterUnmount(this.iframe.contentWindow);
          }
        }
      }
    }
  
    /**
     * Create web component as container
     */
    createWebComponent() {
      // Check if web component is defined
      if (!customElements.get('mfe-app')) {
        // Define web component
        class MFEApp extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }
          
          connectedCallback() {
            const id = this.getAttribute('data-mfe-id');
            const sandbox = getSandboxById(id);
            if (sandbox) {
              sandbox.shadowRoot = this.shadowRoot;
            }
          }
          
          disconnectedCallback() {
            const id = this.getAttribute('data-mfe-id');
            const sandbox = getSandboxById(id);
            if (sandbox) {
              sandbox.unmount();
            }
          }
        }
        customElements.define('mfe-app', MFEApp);
      }
      
      // Create web component instance
      const webComponent = document.createElement('mfe-app');
      webComponent.setAttribute('data-mfe-id', this.name);
      webComponent.style.display = 'block';
      webComponent.style.width = '100%';
      webComponent.style.height = '100%';
      
      return webComponent;
    }
  
    /**
     * Create proxy for window object in iframe
     */
    createProxyWindow(iframeWindow) {
      // Basic proxy for window object
      return new Proxy(iframeWindow, {
        get: (target, prop) => {
          if (prop === '__MFE') {
            return target.__MFE;
          }
          
          // Special handling for location
          if (prop === 'location') {
            return new Proxy(target.location, {
              get: (locationTarget, locationProp) => {
                return locationTarget[locationProp];
              },
              set: (locationTarget, locationProp, value) => {
                locationTarget[locationProp] = value;
                return true;
              }
            });
          }
          
          // Special handling for fetch to support CORS
          if (prop === 'fetch') {
            return this.fetch;
          }
          
          // Get property from target
          const value = target[prop];
          
          // Bind functions to target
          if (typeof value === 'function' && !value.prototype) {
            return value.bind(target);
          }
          
          return value;
        },
        set: (target, prop, value) => {
          target[prop] = value;
          return true;
        }
      });
    }
  
    /**
     * Mount application
     */
    async mount() {
      try {
        // Execute lifecycles
        if (this.lifecycles.beforeMount) {
          this.lifecycles.beforeMount(this.iframe.contentWindow);
        }
        
        // For cross-origin iframes, we use postMessage to communicate
        if (this.iframe && this.iframe.contentWindow) {
          this.iframe.contentWindow.postMessage({
            type: 'mfe-lifecycle',
            action: 'mount'
          }, '*');
        }
        
        // Wait for a brief period to give the iframe time to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (this.lifecycles.afterMount) {
          this.lifecycles.afterMount(this.iframe.contentWindow);
        }
      } catch (error) {
        console.error('Error mounting application:', error);
      }
    }
  
    /**
     * Unmount application
     */
    async unmount() {
      if (this.unmountFlag) return;
      
      try {
        // Execute lifecycles
        if (this.lifecycles.beforeUnmount) {
          this.lifecycles.beforeUnmount(this.iframe.contentWindow);
        }
        
        // For cross-origin iframes, we use postMessage
        if (this.iframe && this.iframe.contentWindow) {
          this.iframe.contentWindow.postMessage({
            type: 'mfe-lifecycle',
            action: 'unmount'
          }, '*');
        }
        
        // Wait for a brief period to give the child app time to unmount
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.mountFlag = false;
        this.unmountFlag = true;
        
        // Clear resources
        this.bus.$clear();
        if (this.shadowRoot) {
          while (this.shadowRoot.firstChild) {
            this.shadowRoot.removeChild(this.shadowRoot.firstChild);
          }
        }
        
        if (this.lifecycles.afterUnmount) {
          this.lifecycles.afterUnmount(this.iframe.contentWindow);
        }
      } catch (error) {
        console.error('Error unmounting application:', error);
      }
    }
  
    /**
     * Show loading indicator
     */
    showLoading(container) {
      if (!container) return;
      
      // Clear container
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      // Create loading indicator
      const loadingDiv = document.createElement('div');
      loadingDiv.setAttribute('data-mfe-loading', '');
      loadingDiv.style.cssText = 'position: absolute; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; z-index: 1;';
      loadingDiv.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="30px" viewBox="0 0 24 30">
          <rect x="0" y="13" width="4" height="5" fill="#909090">
            <animate attributeName="height" attributeType="XML" values="5;21;5" begin="0s" dur="0.6s" repeatCount="indefinite"></animate>
            <animate attributeName="y" attributeType="XML" values="13; 5; 13" begin="0s" dur="0.6s" repeatCount="indefinite"></animate>
          </rect>
          <rect x="10" y="13" width="4" height="5" fill="#909090">
            <animate attributeName="height" attributeType="XML" values="5;21;5" begin="0.15s" dur="0.6s" repeatCount="indefinite"></animate>
            <animate attributeName="y" attributeType="XML" values="13; 5; 13" begin="0.15s" dur="0.6s" repeatCount="indefinite"></animate>
          </rect>
          <rect x="20" y="13" width="4" height="5" fill="#909090">
            <animate attributeName="height" attributeType="XML" values="5;21;5" begin="0.3s" dur="0.6s" repeatCount="indefinite"></animate>
            <animate attributeName="y" attributeType="XML" values="13; 5; 13" begin="0.3s" dur="0.6s" repeatCount="indefinite"></animate>
          </rect>
        </svg>
      `;
      
      container.appendChild(loadingDiv);
    }
  
    /**
     * Hide loading indicator
     */
    hideLoading() {
      if (!this.container) return;
      
      const loadingElement = this.container.querySelector('[data-mfe-loading]');
      if (loadingElement) {
        this.container.removeChild(loadingElement);
      }
    }
  
    /**
     * Destroy application completely
     */
    destroy() {
      this.unmount();
      
      // Clean up message handler
      if (this.messageHandler) {
        window.removeEventListener('message', this.messageHandler);
      }
      
      // Remove iframe
      if (this.iframe && this.iframe.parentNode) {
        this.iframe.parentNode.removeChild(this.iframe);
      }
      
      // Remove from registry
      if (window.__MFE_SANDBOX_REGISTRY) {
        window.__MFE_SANDBOX_REGISTRY.delete(this.name);
      }
      
      // Clear properties
      this.iframe = null;
      this.shadowRoot = null;
      this.execQueue = null;
      this.provide = null;
    }
  }
  
  // Registry for sandbox instances
  if (!window.__MFE_SANDBOX_REGISTRY) {
    window.__MFE_SANDBOX_REGISTRY = new Map();
  }
  
  /**
   * Get sandbox instance by id
   */
  function getSandboxById(id) {
    return window.__MFE_SANDBOX_REGISTRY.get(id);
  }
  
  /**
   * Set sandbox instance
   */
  function setSandbox(id, sandbox) {
    window.__MFE_SANDBOX_REGISTRY.set(id, sandbox);
  }
  
  /**
   * Start a micro-frontend application
   */
  export async function startApp(options) {
    const { name, url, el, props, alive = false, degrade = false, fetch } = options;
    
    // Validate options
    if (!name || !url || !el) {
      throw new Error('Missing required parameters (name, url, el)');
    }
    
    // Get container element
    const container = typeof el === 'string' ? document.querySelector(el) : el;
    if (!container) {
      throw new Error(`Container element not found: ${el}`);
    }
    
    // Check if app instance exists
    let sandbox = getSandboxById(name);
    
    if (sandbox) {
      // Update props if needed
      if (props) {
        sandbox.provide.props = props;
      }
      
      // If alive, just return the function to destroy
      if (alive) {
        return () => sandbox.destroy();
      }
      
      // Otherwise unmount and recreate
      await sandbox.unmount();
    }
    
    // Create sandbox with custom fetch if provided
    sandbox = new Sandbox({
      name,
      url,
      container,
      props,
      alive,
      degrade,
      fetch,
      lifecycles: options.lifecycles,
    });
    
    setSandbox(name, sandbox);
    
    // Create iframe
    await sandbox.createIframe();
    
    // Create and mount web component if not degraded
    if (!degrade) {
      const webComponent = sandbox.createWebComponent();
      container.appendChild(webComponent);
    }
    
    // Execute mount
    await sandbox.mount();
    
    // Return destroy function
    return () => sandbox.destroy();
  }
  
  /**
   * Preload a micro-frontend application
   */
  export function preloadApp(options) {
    const { name, url } = options;
    
    // Skip if already loaded
    if (getSandboxById(name)) {
      return;
    }
    
    // Create a hidden iframe to preload
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.setAttribute('data-mfe-preload', name);
    
    document.body.appendChild(iframe);
    
    // Add cross-origin attributes
    iframe.setAttribute('allow', 'cross-origin-isolated');
    iframe.setAttribute('crossorigin', 'anonymous');
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups');
    
    // Set up sandbox context
    iframe.onload = () => {
      iframe.contentWindow.postMessage({
        type: 'mfe-preload',
        id: name
      }, '*');
    };
    
    // Load URL
    iframe.src = url;
    
    // Return promise that resolves when loaded
    return new Promise((resolve) => {
      iframe.onload = () => {
        resolve();
      };
    });
  }
  
  /**
   * Destroy a micro-frontend application
   */
  export function destroyApp(id) {
    const sandbox = getSandboxById(id);
    if (sandbox) {
      sandbox.destroy();
    }
  }
  
  /**
   * Setup a micro-frontend application configuration
   */
  export function setupApp(options) {
    const { name } = options;
    
    if (!name) {
      throw new Error('Missing required parameter: name');
    }
    
    // Store configuration
    if (!window.__MFE_APP_CONFIGS) {
      window.__MFE_APP_CONFIGS = new Map();
    }
    
    window.__MFE_APP_CONFIGS.set(name, options);
  }
  
  /**
   * Helpers for child applications
   */
  
  /**
   * Initialize child application in iframe
   */
  export function initChildApp({ mount, unmount, bootstrap }) {
    // Check if running in an iframe within the MFE framework
    const inIframe = window !== window.parent;
    
    // Set up message handler for cross-origin communication
    const messageHandler = (event) => {
      // Make sure the message is from the parent
      if (event.source !== window.parent) return;
      
      const { type, id, props, event: eventName, payload, action } = event.data || {};
      
      if (type === 'mfe-init') {
        // Initialize child app
        window.__POWERED_BY_MFE = true;
        window.__MFE = {
          id,
          props: props || {},
          bus: {
            $emit: (event, ...args) => {
              // Send event to parent via postMessage
              window.parent.postMessage({
                type: 'mfe-event',
                event,
                payload: args
              }, '*');
            },
            $on: (event, callback) => {
              // Store callback for this event
              if (!window.__MFE_EVENT_HANDLERS) {
                window.__MFE_EVENT_HANDLERS = new Map();
              }
              
              if (!window.__MFE_EVENT_HANDLERS.has(event)) {
                window.__MFE_EVENT_HANDLERS.set(event, []);
              }
              
              window.__MFE_EVENT_HANDLERS.get(event).push(callback);
              
              return window.__MFE.bus;
            },
            $off: (event, callback) => {
              // Remove callback for this event
              if (!window.__MFE_EVENT_HANDLERS || !window.__MFE_EVENT_HANDLERS.has(event)) {
                return window.__MFE.bus;
              }
              
              const callbacks = window.__MFE_EVENT_HANDLERS.get(event);
              const index = callbacks.indexOf(callback);
              
              if (index !== -1) {
                callbacks.splice(index, 1);
              }
              
              return window.__MFE.bus;
            },
            $clear: () => {
              // Clear all event handlers
              window.__MFE_EVENT_HANDLERS = new Map();
              return window.__MFE.bus;
            }
          }
        };
        
        // Execute bootstrap if provided
        if (bootstrap && typeof bootstrap === 'function') {
          bootstrap();
        }
      } else if (type === 'mfe-event' && window.__MFE_EVENT_HANDLERS) {
        // Handle event from parent
        const handlers = window.__MFE_EVENT_HANDLERS.get(eventName) || [];
        handlers.forEach(handler => handler(...(payload || [])));
      } else if (type === 'mfe-lifecycle') {
        if (action === 'mount' && mount) {
          mount();
          // Notify parent that we've mounted
          window.parent.postMessage({ type: 'mfe-lifecycle', action: 'mounted' }, '*');
        } else if (action === 'unmount' && unmount) {
          const result = unmount();
          if (result instanceof Promise) {
            result.then(() => {
              window.parent.postMessage({ type: 'mfe-lifecycle', action: 'unmounted' }, '*');
            });
          } else {
            window.parent.postMessage({ type: 'mfe-lifecycle', action: 'unmounted' }, '*');
          }
        }
      }
    };
    
    if (inIframe) {
      // Set up message listener
      window.addEventListener('message', messageHandler);
      
      // Signal to parent that we're ready
      window.parent.postMessage({ type: 'mfe-ready' }, '*');
      
      // Define lifecycle methods to be called via postMessage
      window.__MFE_MOUNT = mount;
      window.__MFE_UNMOUNT = unmount;
      
      // Return empty object for now - will be populated when parent sends init message
      return {
        bus: {
          $emit: () => {},
          $on: () => ({ $emit: () => {} }),
          $off: () => ({ $emit: () => {} }),
          $clear: () => ({ $emit: () => {} })
        },
        props: {},
        name: ''
      };
    } else {
      // Not running in MFE environment
      return null;
    }
  }
  
  /**
   * State management helper
   */
  export class StateManager {
    constructor(initialState = {}) {
      this.state = initialState;
      this.listeners = [];
      this.bus = null;
      this.name = null;
    }
    
    /**
     * Connect to event bus for sharing state between apps
     */
    connect(name, bus) {
      this.name = name;
      this.bus = bus;
      
      // Listen for state updates from other apps
      this.bus.$on(`state:update:${name}`, (newState) => {
        this.state = { ...this.state, ...newState };
        this.notifyListeners();
      });
      
      return this;
    }
    
    /**
     * Get current state
     */
    getState() {
      return this.state;
    }
    
    /**
     * Update state
     */
    setState(newState) {
      this.state = { ...this.state, ...newState };
      
      // Notify all listeners
      this.notifyListeners();
      
      // Broadcast state change if connected to bus
      if (this.bus && this.name) {
        this.bus.$emit(`state:update:${this.name}`, newState);
      }
      
      return this.state;
    }
    
    /**
     * Subscribe to state changes
     */
    subscribe(listener) {
      this.listeners.push(listener);
      
      // Return unsubscribe function
      return () => {
        this.listeners = this.listeners.filter(l => l !== listener);
      };
    }
    
    /**
     * Notify all listeners
     */
    notifyListeners() {
      this.listeners.forEach(listener => listener(this.state));
    }
  }
  
  // Create global state for sharing between applications
  export const globalState = new StateManager({});