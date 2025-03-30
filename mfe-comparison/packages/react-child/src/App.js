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
        setParentMessage(message);
      });
      
      // Listen for events from Vue sibling
      mfe.bus.$on('vue-to-react', (message) => {
        console.log('Message from Vue sibling:', message);
        // Display message via alert (just for demo purposes)
        alert(`Message from Vue sibling: ${message}`);
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
      mfe.bus.$emit('child:message', `Hello from React Child (${new Date().toLocaleTimeString()})`);
    }
  };
  
  // Communicate with Vue sibling
  const sendMessageToVueSibling = () => {
    if (mfe && mfe.bus) {
      mfe.bus.$emit('react-to-vue', `Message from React sibling (${new Date().toLocaleTimeString()})`);
    }
  };
  
  return (
    <div className="react-child-app">
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
          
          <div className="button-group">
            <button onClick={sendMessageToParent}>
              Send Message to Parent
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

function renderApp() {
  const container = document.getElementById('root');
  if (container) {
    root = ReactDOM.createRoot(container);
    root.render(
      <React.StrictMode>
        <ReactChildApp />
      </React.StrictMode>
    );
  }
}

// If not running as a child app, render directly
if (!mfe) {
  renderApp();
}

export default ReactChildApp;