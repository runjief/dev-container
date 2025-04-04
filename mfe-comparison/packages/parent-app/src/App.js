import React, { useState, useEffect } from 'react';
import { startApp, bus, globalState } from 'simplified-mfe';
import './App.css';

// Main React component that hosts micro frontends
function App() {
  const [counter, setCounter] = useState(0);
  const [message, setMessage] = useState('');
  const [testMode, setTestMode] = useState('webcomponent'); // 'webcomponent' or 'iframe'
  const [childEvents, setChildEvents] = useState([]);
  
  // Initialize global state
  useEffect(() => {
    // Connect global state to bus
    globalState.connect('main', bus);
    
    // Set initial state
    globalState.setState({
      counter,
      parentInfo: {
        name: 'React Parent',
        version: '1.0.0'
      }
    });
    
    // Listen for messages from child apps
    bus.$on('child:message', (msg) => {
      console.log('Parent: Received message from child:', msg);
      setMessage(msg);
    });
    
    // Listen for counter increment requests
    bus.$on('counter:increment', () => {
      console.log('Parent: Received counter increment request');
      setCounter(prev => prev + 1);
    });
    
    // Listen for child event notifications
    bus.$on('child:event', (data) => {
      console.log('Parent: Event from child:', data);
      setChildEvents(prev => [...prev, data]);
    });
    
    return () => {
      bus.$off('child:message');
      bus.$off('counter:increment');
      bus.$off('child:event');
    };
  }, []);
  
  // Update global state when counter changes
  useEffect(() => {
    globalState.setState({ counter });
  }, [counter]);
  
  // Load React child app
  const loadReactChild = () => {
    console.log('Parent: Loading React child app');
    startApp({
      name: 'react-child',
      url: 'http://localhost:3001',
      el: '#react-child-container',
      degrade: testMode === 'iframe',
      props: {
        parentName: 'React Parent',
        // Don't pass functions directly as they can't be serialized
        // Instead, use event-based communication
        eventHandlerId: 'react-child-events'
      }
    });
  };
  
  // Load Vue child app
  const loadVueChild = () => {
    console.log('Parent: Loading Vue child app');
    startApp({
      name: 'vue-child',
      url: 'http://localhost:3002',
      el: '#vue-child-container',
      degrade: testMode === 'iframe',
      props: {
        parentName: 'React Parent',
        // Don't pass functions directly
        eventHandlerId: 'vue-child-events'
      }
    });
  };

  // Trigger event to child apps
  const triggerEvent = () => {
    const eventMessage = `Parent action triggered at ${new Date().toLocaleTimeString()}`;
    console.log('Parent: Triggering event to children:', eventMessage);
    bus.$emit('parent:action', eventMessage);
  };
  
  return (
    <div className="app-container">
      <h1>React Parent Application</h1>
      <button onClick={() => window.mfeDiagnostic && window.mfeDiagnostic.createPanel()}>
        Show MFE Diagnostic
      </button>
      
      <div className="test-controls">
        <h2>Test Mode: {testMode === 'webcomponent' ? 'Web Component' : 'Iframe'}</h2>
        <button onClick={() => setTestMode('webcomponent')}>Use Web Component</button>
        <button onClick={() => setTestMode('iframe')}>Use Iframe</button>
      </div>
      
      <div className="control-panel">
        <h2>Parent Controls</h2>
        <p>Counter: {counter}</p>
        <button onClick={() => setCounter(counter + 1)}>Increment Counter</button>
        <button onClick={triggerEvent}>
          Trigger Event
        </button>
        
        {message && (
          <div className="message-container">
            <h3>Message from Child:</h3>
            <p>{message}</p>
          </div>
        )}

        {childEvents.length > 0 && (
          <div className="message-container">
            <h3>Events from Children:</h3>
            <ul>
              {childEvents.map((event, index) => (
                <li key={index}>
                  {event.source} at {event.time}: {event.type}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <div className="children-container">
        <div className="child-app">
          <h2>React Child Container</h2>
          <button onClick={loadReactChild}>Load React Child</button>
          <div id="react-child-container" className="container"></div>
        </div>
        
        <div className="child-app">
          <h2>Vue Child Container</h2>
          <button onClick={loadVueChild}>Load Vue Child</button>
          <div id="vue-child-container" className="container"></div>
        </div>
      </div>
    </div>
  );
}

export default App;