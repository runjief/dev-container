/**
 * MFE Diagnostic Utility
 * 
 * This utility helps diagnose issues with the MFE framework and communication between apps.
 */

/**
 * Create a diagnostic panel for the MFE
 */
export function createDiagnosticPanel() {
    // Create panel element
    const panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed;
      bottom: 0;
      right: 0;
      width: 400px;
      height: 300px;
      background-color: rgba(0, 0, 0, 0.8);
      color: white;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      overflow: auto;
      z-index: 10000;
      border-top-left-radius: 5px;
    `;
    
    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      border-bottom: 1px solid #666;
      padding-bottom: 5px;
    `;
    
    const title = document.createElement('span');
    title.textContent = 'MFE Diagnostic Panel';
    title.style.fontWeight = 'bold';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      background: #555;
      border: none;
      color: white;
      padding: 2px 5px;
      cursor: pointer;
    `;
    closeBtn.onclick = () => panel.remove();
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);
    
    // Create tabs
    const tabs = document.createElement('div');
    tabs.style.cssText = `
      display: flex;
      margin-bottom: 10px;
    `;
    
    const tabEvents = document.createElement('button');
    tabEvents.textContent = 'Events';
    tabEvents.style.cssText = `
      background: #333;
      border: none;
      color: white;
      padding: 5px 10px;
      cursor: pointer;
      margin-right: 5px;
      border-bottom: 2px solid #00aaff;
    `;
    
    const tabState = document.createElement('button');
    tabState.textContent = 'State';
    tabState.style.cssText = `
      background: #333;
      border: none;
      color: white;
      padding: 5px 10px;
      cursor: pointer;
      margin-right: 5px;
    `;
    
    const tabApps = document.createElement('button');
    tabApps.textContent = 'Apps';
    tabApps.style.cssText = `
      background: #333;
      border: none;
      color: white;
      padding: 5px 10px;
      cursor: pointer;
    `;
    
    tabs.appendChild(tabEvents);
    tabs.appendChild(tabState);
    tabs.appendChild(tabApps);
    panel.appendChild(tabs);
    
    // Create content area
    const content = document.createElement('div');
    content.style.cssText = `
      height: calc(100% - 70px);
      overflow: auto;
      padding: 5px;
      background: #222;
      border-radius: 3px;
    `;
    panel.appendChild(content);
    
    // Events log
    const eventsLog = document.createElement('div');
    eventsLog.id = 'mfe-events-log';
    
    // State viewer
    const stateViewer = document.createElement('div');
    stateViewer.id = 'mfe-state-viewer';
    stateViewer.style.display = 'none';
    
    // Apps viewer
    const appsViewer = document.createElement('div');
    appsViewer.id = 'mfe-apps-viewer';
    appsViewer.style.display = 'none';
    
    content.appendChild(eventsLog);
    content.appendChild(stateViewer);
    content.appendChild(appsViewer);
    
    // Tab switching
    tabEvents.onclick = () => {
      eventsLog.style.display = 'block';
      stateViewer.style.display = 'none';
      appsViewer.style.display = 'none';
      tabEvents.style.borderBottom = '2px solid #00aaff';
      tabState.style.borderBottom = 'none';
      tabApps.style.borderBottom = 'none';
    };
    
    tabState.onclick = () => {
      eventsLog.style.display = 'none';
      stateViewer.style.display = 'block';
      appsViewer.style.display = 'none';
      tabEvents.style.borderBottom = 'none';
      tabState.style.borderBottom = '2px solid #00aaff';
      tabApps.style.borderBottom = 'none';
      
      refreshStateViewer();
    };
    
    tabApps.onclick = () => {
      eventsLog.style.display = 'none';
      stateViewer.style.display = 'none';
      appsViewer.style.display = 'block';
      tabEvents.style.borderBottom = 'none';
      tabState.style.borderBottom = 'none';
      tabApps.style.borderBottom = '2px solid #00aaff';
      
      refreshAppsViewer();
    };
    
    // Add to DOM
    document.body.appendChild(panel);
    
    // Initialize event logging
    initEventLogging();
    
    return panel;
  }
  
  /**
   * Initialize event logging by hijacking the event bus
   */
  function initEventLogging() {
    if (!window.__MFE_EVENT_REGISTRY) return;
  
    // Add log entry
    function addLogEntry(source, action, event, data) {
      const log = document.getElementById('mfe-events-log');
      if (!log) return;
      
      const entry = document.createElement('div');
      entry.style.cssText = `
        margin-bottom: 5px;
        border-bottom: 1px solid #444;
        padding-bottom: 5px;
      `;
      
      const timestamp = new Date().toLocaleTimeString();
      const header = document.createElement('div');
      header.innerHTML = `<span style="color: #aaa;">[${timestamp}]</span> <span style="color: ${
        source === 'parent' ? '#ffaa00' : '#00aaff'
      };">${source}</span> <span style="color: ${
        action === 'emit' ? '#44ff44' : '#ff6644'
      };">${action}</span> <span style="color: #ffff44;">${event}</span>`;
      
      entry.appendChild(header);
      
      if (data && data.length > 0) {
        const dataEl = document.createElement('pre');
        dataEl.style.cssText = `
          margin: 5px 0 0 20px;
          color: #aaa;
          font-size: 10px;
          white-space: pre-wrap;
        `;
        dataEl.textContent = JSON.stringify(data, null, 2);
        entry.appendChild(dataEl);
      }
      
      log.prepend(entry);
      
      // Limit log entries
      if (log.childElementCount > 100) {
        log.removeChild(log.lastElementChild);
      }
    }
    
    // Hijack event bus emission
    window.__MFE_EVENT_REGISTRY.forEach((events, busId) => {
      // Get the event bus instance
      const bus = busId === 'main' ? window.bus : window.__MFE_SANDBOX_REGISTRY?.get(busId)?.bus;
      
      if (bus) {
        const originalEmit = bus.$emit;
        bus.$emit = function(event, ...args) {
          // Log the emission
          addLogEntry(busId === 'main' ? 'parent' : busId, 'emit', event, args);
          
          // Call original
          return originalEmit.call(this, event, ...args);
        };
        
        const originalOn = bus.$on;
        bus.$on = function(event, callback) {
          // Log the subscription
          addLogEntry(busId === 'main' ? 'parent' : busId, 'subscribe', event, []);
          
          // Call original
          return originalOn.call(this, event, callback);
        };
      }
    });
    
    // Log initial message
    addLogEntry('system', 'info', 'Diagnostic initialized', []);
  }
  
  /**
   * Refresh the state viewer tab
   */
  function refreshStateViewer() {
    const stateViewer = document.getElementById('mfe-state-viewer');
    if (!stateViewer) return;
    
    stateViewer.innerHTML = '';
    
    // Get all state instances
    const states = [];
    
    // Get global state
    if (window.globalState) {
      states.push({
        name: 'Global',
        state: window.globalState.getState()
      });
    }
    
    // Get app states
    if (window.__MFE_SANDBOX_REGISTRY) {
      window.__MFE_SANDBOX_REGISTRY.forEach((sandbox, id) => {
        if (sandbox.provide && sandbox.provide.bus) {
          states.push({
            name: id,
            state: sandbox.provide.props
          });
        }
      });
    }
    
    // Add state entries
    states.forEach(({ name, state }) => {
      const stateEntry = document.createElement('div');
      stateEntry.style.cssText = `
        margin-bottom: 10px;
        border-bottom: 1px solid #444;
        padding-bottom: 10px;
      `;
      
      const header = document.createElement('div');
      header.style.cssText = `
        font-weight: bold;
        margin-bottom: 5px;
        color: #ffaa00;
      `;
      header.textContent = name;
      
      const stateContent = document.createElement('pre');
      stateContent.style.cssText = `
        margin: 0;
        padding: 5px;
        background: #333;
        color: #aaa;
        font-size: 10px;
        white-space: pre-wrap;
        border-radius: 3px;
      `;
      stateContent.textContent = JSON.stringify(state, null, 2);
      
      stateEntry.appendChild(header);
      stateEntry.appendChild(stateContent);
      stateViewer.appendChild(stateEntry);
    });
    
    if (states.length === 0) {
      stateViewer.innerHTML = '<div style="color: #aaa;">No state data available</div>';
    }
  }
  
  /**
   * Refresh the apps viewer tab
   */
  function refreshAppsViewer() {
    const appsViewer = document.getElementById('mfe-apps-viewer');
    if (!appsViewer) return;
    
    appsViewer.innerHTML = '';
    
    // Get all sandboxed apps
    const apps = [];
    
    if (window.__MFE_SANDBOX_REGISTRY) {
      window.__MFE_SANDBOX_REGISTRY.forEach((sandbox, id) => {
        apps.push({
          id,
          url: sandbox.url,
          mounted: sandbox.mountFlag,
          degrade: sandbox.degrade
        });
      });
    }
    
    // Add app entries
    apps.forEach((app) => {
      const appEntry = document.createElement('div');
      appEntry.style.cssText = `
        margin-bottom: 10px;
        border-bottom: 1px solid #444;
        padding-bottom: 10px;
      `;
      
      const header = document.createElement('div');
      header.style.cssText = `
        font-weight: bold;
        margin-bottom: 5px;
        color: #00aaff;
      `;
      header.textContent = app.id;
      
      const status = document.createElement('div');
      status.style.cssText = `
        margin-bottom: 5px;
      `;
      status.innerHTML = `
        <span style="color: #aaa;">Status:</span> 
        <span style="color: ${app.mounted ? '#44ff44' : '#ff6644'};">
          ${app.mounted ? 'Mounted' : 'Not Mounted'}
        </span>
      `;
      
      const mode = document.createElement('div');
      mode.style.cssText = `
        margin-bottom: 5px;
      `;
      mode.innerHTML = `
        <span style="color: #aaa;">Mode:</span> 
        <span style="color: ${app.degrade ? '#ffaa00' : '#44ff44'};">
          ${app.degrade ? 'Iframe' : 'Web Component'}
        </span>
      `;
      
      const url = document.createElement('div');
      url.style.cssText = `
        margin-bottom: 5px;
        color: #aaa;
        font-size: 10px;
        word-break: break-all;
      `;
      url.textContent = app.url;
      
      appEntry.appendChild(header);
      appEntry.appendChild(status);
      appEntry.appendChild(mode);
      appEntry.appendChild(url);
      appsViewer.appendChild(appEntry);
    });
    
    if (apps.length === 0) {
      appsViewer.innerHTML = '<div style="color: #aaa;">No apps loaded</div>';
    }
  }
  
  /**
   * Create a test message function to manually send events
   */
  export function testMessage(source, target, event, data = {}) {
    console.log(`[Test] Sending "${event}" from ${source} to ${target}`);
    
    if (source === 'parent' && window.bus) {
      window.bus.$emit(event, data);
      return true;
    }
    
    if (target === 'parent' && window.__MFE && window.__MFE.bus) {
      window.__MFE.bus.$emit(event, data);
      return true;
    }
    
    if (source === 'parent' && window.__MFE_SANDBOX_REGISTRY) {
      const sandbox = window.__MFE_SANDBOX_REGISTRY.get(target);
      if (sandbox && sandbox.bus) {
        sandbox.bus.$emit(event, data);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Add this to the global window to make it accessible from the console
   */
  window.mfeDiagnostic = {
    createPanel: createDiagnosticPanel,
    testMessage: testMessage
  };