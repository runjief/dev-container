import React, { useState, useEffect } from 'react';
import * as ReactDOM from 'react-dom/client';
import { initChildApp, StateManager } from 'simplified-mfe';
import './App.css';

// Create local state manager
const localState = new StateManager({
  localCounter: 0
});

let root = null;

// Initialize the child app
const mfe = initChildApp({
  bootstrap: () => {
    console.log('React child app bootstrapped');
  },
  mount: () => {
    console.log('React child app mounted');
    renderApp();
  },
  unmount: () => {
    console.log('React child app unmounted');
    return new Promise((resolve) => {
      if (root) {
        root.unmount();
        root = null;
      }
      resolve();
    });
  }
});

// Connect to parent if running in MFE environment
if (mfe) {
  localState.connect('react-child', mfe.bus);
}

function ReactChildApp() {
  const [parentCounter, setParentCounter] = useState(0);
  const [localCounter, setLocalCounter] = useState(0);
  const [parentMessage, setParentMessage] = useState('');
  const [vueMessage, setVueMessage] = useState('');
  
  useEffect(() => {
    // Subscribe to local state changes
    const unsubscribe = localState.subscribe((state) => {
      setLocalCounter(state.localCounter);
    });
    
    if (mfe && mfe.bus) {
      // Listen for parent state updates
      mfe.bus.$on('state:update:main', (state) => {
        if (state.counter !== undefined) {
          setParentCounter(state.counter);
        }
      });
      
      // Listen for events from parent
      mfe.bus.$on('parent:action', (message) => {
        console.log('React Child: Received message from parent:', message);
        setParentMessage(message);
      });
      
      // Listen for events from Vue sibling
      mfe.bus.$on('vue-to-react', (message) => {
        console.log('React Child: Received message from Vue sibling:', message);
        setVueMessage(message);
      });
      
      // Get initial parent state if available
      mfe.bus.$emit('state:get:main');
    }
    
    return () => {
      unsubscribe();
      if (mfe && mfe.bus) {
        mfe.bus.$off('state:update:main');
        mfe.bus.$off('parent:action');
        mfe.bus.$off('vue-to-react');
      }
    };
  }, []);
  
  // Update local state and notify
  const incrementLocalCounter = () => {
    const newValue = localCounter + 1;
    setLocalCounter(newValue);
    localState.setState({ localCounter: newValue });
  };
  
  // Request parent to increment counter
  const requestParentIncrement = () => {
    if (mfe && mfe.bus) {
      mfe.bus.$emit('counter:increment');
    }
  };
  
  // Send message to parent
  const sendMessageToParent = () => {
    if (mfe && mfe.bus) {
      const message = `Hello from React Child (${new Date().toLocaleTimeString()})`;
      console.log('React Child: Sending message to parent:', message);
      mfe.bus.$emit('child:message', message);
    }
  };
  
  // Instead of calling parent callback directly, emit an event
  const sendEventToParent = () => {
    if (mfe && mfe.bus) {
      // Send event to parent
      const eventData = {
        source: 'React Child',
        time: new Date().toLocaleTimeString(),
        type: 'user-action'
      };
      console.log('React Child: Sending event to parent:', eventData);
      mfe.bus.$emit('child:event', eventData);
    }
  };
  
  // Communicate with Vue sibling
  const sendMessageToVueSibling = () => {
    if (mfe && mfe.bus) {
      const message = `Message from React sibling (${new Date().toLocaleTimeString()})`;
      console.log('React Child: Sending message to Vue sibling:', message);
      mfe.bus.$emit('react-to-vue', message);
    }
  };
  
  // Return with explicit height and width styling to ensure proper rendering
  return (
    <div className="react-child-app" style={{ height: '100%', width: '100%', overflow: 'auto' }}>
      <h2>React Child Application</h2>
      
      <div className="state-display">
        <div className="counter-section">
          <h3>State Management</h3>
          <p>Parent Counter: {parentCounter}</p>
          <p>Local Counter: {localCounter}</p>
          
          <div className="button-group">
            <button onClick={incrementLocalCounter}>
              Increment Local
            </button>
            <button onClick={requestParentIncrement}>
              Request Parent Increment
            </button>
          </div>
        </div>
        
        <div className="communication-section">
          <h3>Communication</h3>
          
          {parentMessage && (
            <div className="message">
              <p><strong>From Parent:</strong> {parentMessage}</p>
            </div>
          )}
          
          {vueMessage && (
            <div className="message">
              <p><strong>From Vue Sibling:</strong> {vueMessage}</p>
            </div>
          )}
          
          <div className="button-group">
            <button onClick={sendMessageToParent}>
              Send Message to Parent
            </button>
            <button onClick={sendEventToParent}>
              Send Event to Parent
            </button>
            <button onClick={sendMessageToVueSibling}>
              Send Message to Vue Sibling
            </button>
          </div>
        </div>
      </div>
      
      <div className="props-display">
        <h3>Props from Parent</h3>
        <pre>{JSON.stringify(mfe?.props || {}, null, 2)}</pre>
      </div>
    </div>
  );
}

// Updated renderApp function with fixes for proper rendering
function renderApp() {
  // First try to get the container from the main page
  let container = document.getElementById('root');
  
  // If we're in a MFE environment and can't find the root element,
  // create one to ensure we have somewhere to render
  if (!container && window.__POWERED_BY_MFE) {
    console.log('[React Child] Creating root element');
    container = document.createElement('div');
    container.id = 'root';
    container.style.cssText = 'width: 100%; height: 100%; overflow: auto;';
    document.body.appendChild(container);
    
    // Also add some base styles to ensure proper rendering in both iframe and web component modes
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
        #root {
          height: 100%;
          width: 100%;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }
  
  if (container) {
    root = ReactDOM.createRoot(container);
    root.render(
      <React.StrictMode>
        <ReactChildApp />
      </React.StrictMode>
    );
    
    // Signal to parent that component is rendered
    if (window.__POWERED_BY_MFE && window.parent) {
      window.parent.postMessage({ type: 'mfe-rendered', app: 'react-child' }, '*');
    }
  } else {
    console.error('[React Child] Could not find or create root element');
  }
}

// If not running as a child app, render directly
if (!mfe) {
  renderApp();
}

export default ReactChildApp;