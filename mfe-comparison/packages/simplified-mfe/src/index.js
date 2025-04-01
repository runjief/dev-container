/**
 * Simplified Micro-Frontend Framework based on Wujie - Fixed Version
 * 
 * This framework implements core functionality from Wujie with minimal overhead
 * to enable accurate performance comparison between iframe and web component approaches.
 * 
 * Includes fixes for:
 * 1. Communication between components
 * 2. State management
 * 3. Rendering issues in both web component and iframe modes
 */

/**
 * Core module: event bus for communication between applications
 */
export class EventBus {
  constructor(id) {
    this.id = id;
    
    // Get global event registry or create it
    if (!window.__MFE_EVENT_REGISTRY) {
      window.__MFE_EVENT_REGISTRY = new Map();
    }
    
    // Get existing events for this ID or create new
    this.events = window.__MFE_EVENT_REGISTRY.get(id) || {};
    this.allEvents = this.events._all || [];
    
    // Store events back in registry
    window.__MFE_EVENT_REGISTRY.set(id, this.events);
    
    // Store all events under _all key
    this.events._all = this.allEvents;
    
    console.log(`[EventBus:${id}] Created event bus`);
  }

  // Listen for a specific event
  $on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    if (!this.events[event].includes(callback)) {
      this.events[event].push(callback);
      console.log(`[EventBus:${this.id}] Registered handler for event: ${event}`);
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
      if (callback) {
        const index = this.events[event].indexOf(callback);
        if (index !== -1) {
          this.events[event].splice(index, 1);
        }
      } else {
        // If no callback provided, remove all handlers for this event
        this.events[event] = [];
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
    // Log for debugging
    console.log(`[EventBus:${this.id}] Emitting event: ${event}`, args);
    
    // Execute local handlers first
    if (this.events[event]) {
      this.events[event].forEach(handler => {
        try {
          handler(...args);
        } catch (err) {
          console.error(`[EventBus:${this.id}] Error executing handler for event ${event}:`, err);
        }
      });
    }
    
    // Execute "listen all" handlers
    this.allEvents.forEach(handler => {
      try {
        handler(event, ...args);
      } catch (err) {
        console.error(`[EventBus:${this.id}] Error executing "listen all" handler for event ${event}:`, err);
      }
    });
    
    // Also broadcast to all other buses unless it's a state or private event
    if (!event.startsWith('state:') && !event.startsWith('_')) {
      window.__MFE_EVENT_REGISTRY.forEach((events, busId) => {
        if (busId !== this.id) {
          const handlers = events[event] || [];
          const allHandlers = events._all || [];
          
          // Execute specific handlers
          handlers.forEach(handler => {
            try {
              handler(...args);
            } catch (err) {
              console.error(`[EventBus:${this.id}->EventBus:${busId}] Error executing handler for event ${event}:`, err);
            }
          });
          
          // Execute "listen all" handlers
          allHandlers.forEach(handler => {
            try {
              handler(event, ...args);
            } catch (err) {
              console.error(`[EventBus:${this.id}->EventBus:${busId}] Error executing "listen all" handler for event ${event}:`, err);
            }
          });
        }
      });
    }
    
    return this;
  }

  // Clear all event listeners
  $clear() {
    this.events = {};
    this.allEvents = [];
    this.events._all = this.allEvents;
    window.__MFE_EVENT_REGISTRY.set(this.id, this.events);
    return this;
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
    
    // Make sure to debounce state updates to avoid performance issues
    const debouncedNotify = this.debounce(() => this.notifyListeners(), 20);
    
    // Listen for state updates from other apps
    this.bus.$on(`state:update:${name}`, (newState) => {
      console.log(`[StateManager:${name}] Received state update:`, newState);
      this.state = { ...this.state, ...newState };
      debouncedNotify();
    });
    
    // Listen for state requests
    this.bus.$on(`state:get:${name}`, () => {
      console.log(`[StateManager:${name}] Received state request, broadcasting current state`);
      // Broadcast current state
      this.bus.$emit(`state:update:${name}`, this.state);
    });
    
    // Request initial state from other instances
    setTimeout(() => {
      this.bus.$emit(`state:get:${name}`);
    }, 50);
    
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
    const prevState = { ...this.state };
    this.state = { ...this.state, ...newState };
    
    // Only notify if state actually changed
    if (JSON.stringify(prevState) !== JSON.stringify(this.state)) {
      // Notify all listeners
      this.notifyListeners();
      
      // Broadcast state change if connected to bus
      if (this.bus && this.name) {
        console.log(`[StateManager:${this.name}] Broadcasting state update:`, newState);
        this.bus.$emit(`state:update:${this.name}`, newState);
      }
    }
    
    return this.state;
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener) {
    this.listeners.push(listener);
    
    // Immediately notify with current state
    listener(this.state);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Notify all listeners
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Error notifying state listener:', err);
      }
    });
  }
  
  /**
   * Simple debounce implementation for state updates
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Create global state for sharing between applications
export const globalState = new StateManager({});

// Create a main event bus instance
export const bus = new EventBus('main');

/**
 * Core module: iframe sandboxing with improved rendering
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
    this.shadowIframe = null;
    this.execQueue = [];
    this.mountFlag = false;
    this.unmountFlag = false;
    this.lifecycles = options.lifecycles || {};
    this.fetch = fetch || window.fetch;
    this.readyPromise = null;
    this.readyResolve = null;

    // Provide object for child app to access
    this.provide = {
      bus: this.bus,
      props: options.props || {},
      fetch: this.fetch
    };
    
    // Create a promise that will be resolved when the child app is ready
    this.readyPromise = new Promise(resolve => {
      this.readyResolve = resolve;
    });
  }

  /**
   * Create and load iframe
   */
  async createIframe() {
    console.log(`[Sandbox:${this.name}] Creating iframe`);
    
    // Create iframe
    const iframe = document.createElement('iframe');
    
    // Set attributes
    iframe.style.cssText = `
      border: none;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    `;
    
    // Set display based on mode
    iframe.style.display = this.degrade ? 'block' : 'none';
    
    // Add CORS attributes to allow cross-origin communication
    iframe.setAttribute('allow', 'cross-origin-isolated');
    iframe.setAttribute('crossorigin', 'anonymous');
    iframe.setAttribute('data-mfe-id', this.name);
    
    // Enable cross-origin access with all necessary permissions
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-downloads');
    
    // If in degrade mode (iframe mode), append directly to the container instead of body
    if (this.degrade && this.container) {
      // Make sure container has proper positioning
      if (getComputedStyle(this.container).position === 'static') {
        this.container.style.position = 'relative';
      }
      
      // Clear the container first
      while (this.container.firstChild) {
        this.container.removeChild(this.container.firstChild);
      }
      
      // Append iframe to container
      this.container.appendChild(iframe);
    } else {
      // In web component mode, append to body initially (will be moved to shadow DOM later)
      document.body.appendChild(iframe);
    }
    
    this.iframe = iframe;
    
    // Handle iframe load
    return new Promise(resolve => {
      iframe.onload = () => {
        console.log(`[Sandbox:${this.name}] Iframe loaded`);
        // Try to set up the iframe context
        try {
          // Check if we can access the contentWindow
          if (iframe.contentWindow) {
            console.log(`[Sandbox:${this.name}] Setting up cross-origin messaging`);
            // Set up messaging for cross-origin communication
            this.setupCrossOriginMessaging();
            
            if (!this.degrade) {
              // Show loading indicator in web component mode
              this.showLoading(this.container);
            }
            
            // Send initialization message to iframe
            console.log(`[Sandbox:${this.name}] Sending init message to iframe`);
            iframe.contentWindow.postMessage({
              type: 'mfe-init',
              id: this.name,
              props: this.provide.props
            }, '*');
          }
        } catch (e) {
          console.error(`[Sandbox:${this.name}] Error setting up iframe:`, e);
        }
        
        this.hideLoading();
        resolve();
      };
      
      // Load URL
      console.log(`[Sandbox:${this.name}] Loading URL: ${this.url}`);
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
      if (!this.iframe || event.source !== this.iframe.contentWindow) return;
      
      const { type, event: eventName, payload, action, id } = event.data || {};
      console.log(`[Sandbox:${this.name}] Received message from iframe:`, event.data);
      
      if (type === 'mfe-ready') {
        console.log(`[Sandbox:${this.name}] Child app is ready`);
        if (this.readyResolve) {
          this.readyResolve();
        }
      } else if (type === 'mfe-rendered') {
        console.log(`[Sandbox:${this.name}] Child app has rendered`);
        // If in degraded mode, make sure the iframe is visible
        if (this.degrade && this.iframe) {
          this.iframe.style.display = 'block';
        }
        
        // Also hide any loading indicators
        this.hideLoading();
      } else if (type === 'mfe-event' && eventName) {
        // Handle event emitted from child
        console.log(`[Sandbox:${this.name}] Received event from child: ${eventName}`, payload);
        
        // Emit to local event bus
        if (Array.isArray(payload)) {
          this.bus.$emit(eventName, ...payload);
        } else {
          this.bus.$emit(eventName, payload);
        }
      } else if (type === 'mfe-lifecycle') {
        if (action === 'mounted') {
          console.log(`[Sandbox:${this.name}] Child app mounted`);
          this.mountFlag = true;
          if (this.lifecycles.afterMount) {
            this.lifecycles.afterMount(this.iframe.contentWindow);
          }
        } else if (action === 'unmounted') {
          console.log(`[Sandbox:${this.name}] Child app unmounted`);
          this.unmountFlag = true;
          if (this.lifecycles.afterUnmount) {
            this.lifecycles.afterUnmount(this.iframe.contentWindow);
          }
        }
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
        console.log(`[Sandbox:${this.name}] Sending event to iframe: ${event}`, args);
        this.iframe.contentWindow.postMessage({
          type: 'mfe-event',
          event,
          payload: args
        }, '*');
      }
      
      // Also send to shadow iframe if it exists
      if (this.shadowIframe && this.shadowIframe.contentWindow) {
        console.log(`[Sandbox:${this.name}] Sending event to shadow iframe: ${event}`, args);
        this.shadowIframe.contentWindow.postMessage({
          type: 'mfe-event',
          event,
          payload: args
        }, '*');
      }
      
      return this.bus;
    };
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
          // Create shadow DOM with open mode for access
          this.attachShadow({ mode: 'open' });
        }
        
        connectedCallback() {
          const id = this.getAttribute('data-mfe-id');
          const sandbox = getSandboxById(id);
          if (sandbox) {
            sandbox.shadowRoot = this.shadowRoot;
            
            // Create container element for child app within shadow DOM
            const container = document.createElement('div');
            container.id = 'mfe-shadow-container';
            container.style.cssText = 'width: 100%; height: 100%; position: relative;';
            this.shadowRoot.appendChild(container);
            
            // If we have an iframe reference
            if (sandbox.iframe) {
              // Clone the iframe for the shadow DOM
              const shadowIframe = document.createElement('iframe');
              
              // Copy attributes from original iframe
              for (let attr of sandbox.iframe.attributes) {
                shadowIframe.setAttribute(attr.name, attr.value);
              }
              
              // Set styles for proper display
              shadowIframe.style.cssText = `
                border: none;
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: block;
              `;
              
              // Use the same src as the original iframe
              shadowIframe.src = sandbox.iframe.src;
              
              // Append to shadow container
              container.appendChild(shadowIframe);
              
              // Store reference to shadow iframe
              sandbox.shadowIframe = shadowIframe;
              
              console.log(`[Sandbox:${id}] Created shadow iframe`);
            }
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
    webComponent.style.cssText = `
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    `;
    
    return webComponent;
  }

  /**
   * Mount application
   */
  async mount() {
    console.log(`[Sandbox:${this.name}] Mounting application`);
    try {
      // Wait for ready signal from child app with a timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Child app ready signal timeout')), 5000)
      );
      
      // Wait for ready or timeout
      await Promise.race([this.readyPromise, timeoutPromise]).catch(err => {
        console.warn(`[Sandbox:${this.name}] ${err.message}, proceeding anyway`);
      });
      
      // Execute lifecycles
      if (this.lifecycles.beforeMount) {
        this.lifecycles.beforeMount(this.iframe.contentWindow);
      }
      
      // Send mount command to iframe
      if (this.iframe && this.iframe.contentWindow) {
        console.log(`[Sandbox:${this.name}] Sending mount command to iframe`);
        this.iframe.contentWindow.postMessage({
          type: 'mfe-lifecycle',
          action: 'mount'
        }, '*');
      }
      
      // Do the same for shadow iframe if it exists
      if (this.shadowIframe && this.shadowIframe.contentWindow) {
        setTimeout(() => {
          console.log(`[Sandbox:${this.name}] Sending mount command to shadow iframe`);
          this.shadowIframe.contentWindow.postMessage({
            type: 'mfe-lifecycle',
            action: 'mount'
          }, '*');
        }, 100);
      }
      
      // Wait for a brief period
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (this.lifecycles.afterMount) {
        this.lifecycles.afterMount(this.iframe.contentWindow);
      }
    } catch (error) {
      console.error(`[Sandbox:${this.name}] Error mounting application:`, error);
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
   * Unmount application
   */
  async unmount() {
    console.log(`[Sandbox:${this.name}] Unmounting application`);
    if (this.unmountFlag) return;
    
    try {
      // Execute lifecycles
      if (this.lifecycles.beforeUnmount) {
        this.lifecycles.beforeUnmount(this.iframe.contentWindow);
      }
      
      // Send unmount command to iframe
      if (this.iframe && this.iframe.contentWindow) {
        console.log(`[Sandbox:${this.name}] Sending unmount command to iframe`);
        this.iframe.contentWindow.postMessage({
          type: 'mfe-lifecycle',
          action: 'unmount'
        }, '*');
      }
      
      // Also send to shadow iframe if exists
      if (this.shadowIframe && this.shadowIframe.contentWindow) {
        this.shadowIframe.contentWindow.postMessage({
          type: 'mfe-lifecycle',
          action: 'unmount'
        }, '*');
      }
      
      // Wait for child to process unmount
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.mountFlag = false;
      this.unmountFlag = true;
      
      // Clear resources
      this.bus.$clear();
      
      // Clean up shadow DOM
      if (this.shadowRoot) {
        while (this.shadowRoot.firstChild) {
          this.shadowRoot.removeChild(this.shadowRoot.firstChild);
        }
      }
      
      if (this.lifecycles.afterUnmount) {
        this.lifecycles.afterUnmount(this.iframe.contentWindow);
      }
    } catch (error) {
      console.error(`[Sandbox:${this.name}] Error unmounting application:`, error);
    }
  }

  /**
   * Destroy application completely
   */
  destroy() {
    console.log(`[Sandbox:${this.name}] Destroying application`);
    this.unmount();
    
    // Clean up message handler
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
    }
    
    // Remove iframe from DOM
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    
    // Remove shadow iframe
    if (this.shadowIframe && this.shadowIframe.parentNode) {
      this.shadowIframe.parentNode.removeChild(this.shadowIframe);
    }
    
    // Remove from registry
    if (window.__MFE_SANDBOX_REGISTRY) {
      window.__MFE_SANDBOX_REGISTRY.delete(this.name);
    }
    
    // Clear properties
    this.iframe = null;
    this.shadowIframe = null;
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
  
  console.log(`[MFE] Starting app: ${name}`);
  
  // Validate options
  if (!name || !url || !el) {
    throw new Error('Missing required parameters (name, url, el)');
  }
  
  // Get container element
  const container = typeof el === 'string' ? document.querySelector(el) : el;
  if (!container) {
    throw new Error(`Container element not found: ${el}`);
  }
  
  // Ensure container has proper styles for hosting iframes/web components
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }
  
  // Make sure container has height
  if (!container.style.height && container.offsetHeight === 0) {
    console.warn(`[MFE] Container for ${name} has no height, setting to 400px`);
    container.style.height = '400px';
  }
  
  // Check if app instance exists
  let sandbox = getSandboxById(name);
  
  if (sandbox) {
    console.log(`[MFE] App instance exists: ${name}`);
    // Update props if needed
    if (props) {
      sandbox.provide.props = props;
      // Send updated props to child app
      if (sandbox.iframe && sandbox.iframe.contentWindow) {
        sandbox.iframe.contentWindow.postMessage({
          type: 'mfe-props-update',
          props
        }, '*');
      }
    }
    
    // If alive, just return the function to destroy
    if (alive) {
      return () => sandbox.destroy();
    }
    
    // Otherwise unmount and recreate
    await sandbox.unmount();
    
    // Delete old sandbox and create new one
    window.__MFE_SANDBOX_REGISTRY.delete(name);
    sandbox = null;
  }
  
  console.log(`[MFE] Creating new sandbox for ${name}`);
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
    console.log(`[MFE] Creating web component for ${name}`);
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
 * Initialize child application in iframe - Fixed version
 */
export function initChildApp({ mount, unmount, bootstrap }) {
  // Check if running in an iframe within the MFE framework
  const inIframe = window !== window.parent;
  
  if (inIframe) {
    console.log('[Child App] Initializing as a child application');
    
    // Initialize event handlers storage if not existing
    if (!window.__MFE_EVENT_HANDLERS) {
      window.__MFE_EVENT_HANDLERS = new Map();
    }
    
    // Set up message handler for cross-origin communication
    const messageHandler = (event) => {
      // Make sure the message is from the parent
      if (event.source !== window.parent) return;
      
      const { type, id, props, event: eventName, payload, action } = event.data || {};
      console.log('[Child App] Received message from parent:', event.data);
      
      if (type === 'mfe-init') {
        // Initialize child app
        window.__POWERED_BY_MFE = true;
        window.__MFE = {
          id,
          props: props || {},
          bus: {
            $emit: (event, ...args) => {
              console.log(`[Child:${id}] Emitting event to parent:`, event, args);
              // Send event to parent via postMessage
              window.parent.postMessage({
                type: 'mfe-event',
                event,
                payload: args
              }, '*');
              
              // Also execute any local handlers (for sibling communication)
              const handlers = window.__MFE_EVENT_HANDLERS.get(event) || [];
              handlers.forEach(handler => {
                try {
                  handler(...args);
                } catch (err) {
                  console.error(`[Child:${id}] Error executing local handler for event ${event}:`, err);
                }
              });
              
              return window.__MFE.bus;
            },
            $on: (event, callback) => {
              // Store callback for this event
              if (!window.__MFE_EVENT_HANDLERS.has(event)) {
                window.__MFE_EVENT_HANDLERS.set(event, []);
              }
              
              const handlers = window.__MFE_EVENT_HANDLERS.get(event);
              if (!handlers.includes(callback)) {
                handlers.push(callback);
                console.log(`[Child:${id}] Registered handler for event:`, event);
              }
              
              return window.__MFE.bus;
            },
            $off: (event, callback) => {
              // Remove callback for this event
              if (!window.__MFE_EVENT_HANDLERS || !window.__MFE_EVENT_HANDLERS.has(event)) {
                return window.__MFE.bus;
              }
              
              const callbacks = window.__MFE_EVENT_HANDLERS.get(event);
              if (callback) {
                const index = callbacks.indexOf(callback);
                if (index !== -1) {
                  callbacks.splice(index, 1);
                }
              } else {
                // If no callback specified, remove all handlers for this event
                window.__MFE_EVENT_HANDLERS.set(event, []);
              }
              
              return window.__MFE.bus;
            },
            $clear: () => {
              // Clear all event handlers
              window.__MFE_EVENT_HANDLERS.clear();
              return window.__MFE.bus;
            }
          }
        };
        
        // Add base styles for proper rendering in both iframe and web component modes
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
          #root, #app {
            height: 100%;
            width: 100%;
          }
        `;
        document.head.appendChild(styleEl);
        
        // Execute bootstrap if provided
        if (bootstrap && typeof bootstrap === 'function') {
          bootstrap();
        }
        
        // Tell parent we're ready
        window.parent.postMessage({ 
          type: 'mfe-ready',
          id: id
        }, '*');
      } else if (type === 'mfe-props-update') {
        // Update props
        if (window.__MFE) {
          window.__MFE.props = props || {};
          
          // Dispatch custom event for components to react to
          window.dispatchEvent(new CustomEvent('mfe-props-updated', {
            detail: { props: window.__MFE.props }
          }));
        }
      } else if (type === 'mfe-event' && eventName) {
        // Handle event from parent
        const handlers = window.__MFE_EVENT_HANDLERS.get(eventName) || [];
        console.log(`[Child] Received event "${eventName}" with ${handlers.length} handlers`);
        
        handlers.forEach(handler => {
          try {
            handler(...(payload || []));
          } catch (err) {
            console.error(`Error executing handler for event ${eventName}:`, err);
          }
        });
      } else if (type === 'mfe-lifecycle') {
        if (action === 'mount' && mount) {
          console.log('[Child] Received mount command');
          mount();
          // Notify parent that we've mounted
          window.parent.postMessage({ type: 'mfe-lifecycle', action: 'mounted' }, '*');
          // Also send rendered signal to ensure display
          window.parent.postMessage({ type: 'mfe-rendered', app: id }, '*');
        } else if (action === 'unmount' && unmount) {
          console.log('[Child] Received unmount command');
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
    
    // Set up message listener
    window.addEventListener('message', messageHandler);
    
    // Signal to parent that we're ready to receive messages
    console.log('[Child] Sending ready signal to parent');
    window.parent.postMessage({ type: 'mfe-ready' }, '*');
    
    // Return bus interface for the child app
    return {
      bus: {
        $emit: (event, ...args) => {
          console.log(`[Child] Emitting event "${event}" to parent`);
          window.parent.postMessage({
            type: 'mfe-event',
            event,
            payload: args
          }, '*');
          
          // Also execute any local handlers (for sibling communication)
          const handlers = window.__MFE_EVENT_HANDLERS.get(event) || [];
          handlers.forEach(handler => {
            try {
              handler(...args);
            } catch (err) {
              console.error(`[Child] Error executing local handler for event ${event}:`, err);
            }
          });
          
          return {
            $emit: (...emitArgs) => window.parent.postMessage({
              type: 'mfe-event',
              event: emitArgs[0],
              payload: emitArgs.slice(1)
            }, '*')
          };
        },
        $on: (event, callback) => {
          if (!window.__MFE_EVENT_HANDLERS) {
            window.__MFE_EVENT_HANDLERS = new Map();
          }
          
          if (!window.__MFE_EVENT_HANDLERS.has(event)) {
            window.__MFE_EVENT_HANDLERS.set(event, []);
          }
          
          window.__MFE_EVENT_HANDLERS.get(event).push(callback);
          console.log(`[Child] Registered handler for event "${event}"`);
          
          return {
            $emit: (...args) => window.parent.postMessage({
              type: 'mfe-event',
              event: args[0],
              payload: args.slice(1)
            }, '*')
          };
        },
        $off: (event, callback) => {
          if (!window.__MFE_EVENT_HANDLERS || !window.__MFE_EVENT_HANDLERS.has(event)) {
            return {
              $emit: (...args) => window.parent.postMessage({
                type: 'mfe-event',
                event: args[0],
                payload: args.slice(1)
              }, '*')
            };
          }
          
          const callbacks = window.__MFE_EVENT_HANDLERS.get(event);
          if (callback) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
              callbacks.splice(index, 1);
            }
          } else {
            // If no callback provided, remove all
            window.__MFE_EVENT_HANDLERS.set(event, []);
          }
          
          return {
            $emit: (...args) => window.parent.postMessage({
              type: 'mfe-event',
              event: args[0],
              payload: args.slice(1)
            }, '*')
          };
        }
      },
      props: window.__MFE ? window.__MFE.props : {},
      name: window.__MFE ? window.__MFE.id : ''
    };
  } else {
    // Not running in MFE environment
    console.log('[App] Not running in MFE environment');
    return null;
  }
}