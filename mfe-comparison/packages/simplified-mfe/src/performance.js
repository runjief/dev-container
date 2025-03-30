/**
 * Performance Measurement Utilities
 * 
 * This module provides tools to measure and compare performance between
 * iframe and web component approaches in micro frontends.
 */

/**
 * Initialize performance measurements
 */
export function initPerformanceMeasurement(degradeMode = false) {
    window.__MFE_PERFORMANCE = {
      mode: degradeMode ? 'iframe' : 'webcomponent',
      metrics: {
        // Initial loading
        initialLoadTime: 0,
        timeToFirstPaint: 0,
        timeToInteractive: 0,
        
        // Runtime performance
        memoryUsage: [],
        frameRates: [],
        layoutShifts: 0,
        
        // Communication performance
        messageLatency: [],
        stateUpdateLatency: [],
        
        // Resource usage
        networkRequests: 0,
        totalTransferSize: 0
      },
      marks: {},
      startTime: performance.now()
    };
    
    // Mark the start of measurement
    performance.mark('mfe-measurement-start');
    
    // Initialize memory monitoring (if available)
    if (performance.memory) {
      startMemoryMonitoring();
    }
    
    // Initialize frame rate monitoring
    startFrameRateMonitoring();
    
    // Register communication observer
    registerCommunicationObserver();
    
    // Register layout shift observer
    registerLayoutShiftObserver();
    
    // Collect network metrics (using PerformanceObserver if available)
    if (PerformanceObserver) {
      collectNetworkMetrics();
    }
    
    return window.__MFE_PERFORMANCE;
  }
  
  /**
   * Start monitoring memory usage
   */
  function startMemoryMonitoring() {
    const memoryInterval = setInterval(() => {
      if (!window.__MFE_PERFORMANCE) {
        clearInterval(memoryInterval);
        return;
      }
      
      if (performance.memory) {
        window.__MFE_PERFORMANCE.metrics.memoryUsage.push({
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          timestamp: performance.now() - window.__MFE_PERFORMANCE.startTime
        });
      }
    }, 1000); // Measure every second
    
    // Store the interval ID for cleanup
    window.__MFE_PERFORMANCE.memoryInterval = memoryInterval;
  }
  
  /**
   * Start monitoring frame rate
   */
  function startFrameRateMonitoring() {
    let lastTime = performance.now();
    let frames = 0;
    
    const frameRateInterval = setInterval(() => {
      if (!window.__MFE_PERFORMANCE) {
        clearInterval(frameRateInterval);
        return;
      }
      
      // Calculate frames per second
      const currentFps = frames * 1000 / (performance.now() - lastTime);
      
      window.__MFE_PERFORMANCE.metrics.frameRates.push({
        fps: currentFps,
        timestamp: performance.now() - window.__MFE_PERFORMANCE.startTime
      });
      
      frames = 0;
      lastTime = performance.now();
    }, 1000);
    
    // Count frames using requestAnimationFrame
    const countFrame = () => {
      frames++;
      requestAnimationFrame(countFrame);
    };
    
    requestAnimationFrame(countFrame);
    
    // Store the interval ID for cleanup
    window.__MFE_PERFORMANCE.frameRateInterval = frameRateInterval;
  }
  
  /**
   * Register communication observer to measure message latency
   */
  function registerCommunicationObserver() {
    // Add instrumentation to event bus
    const originalEmit = window.__MFE_EVENT_REGISTRY ? 
      window.__MFE_EVENT_REGISTRY.get('main')?.$emit : null;
    
    if (originalEmit) {
      window.__MFE_EVENT_LATENCY_MAP = new Map();
      
      window.__MFE_EVENT_REGISTRY.get('main').$emit = function(event, ...args) {
        // Record start time for specific message events
        if (event.startsWith('state:') || event.includes('message')) {
          const messageId = `${event}-${Date.now()}-${Math.random()}`;
          window.__MFE_EVENT_LATENCY_MAP.set(messageId, {
            event,
            startTime: performance.now(),
            roundTrip: false
          });
          
          // For round-trip measurement
          if (typeof args[args.length - 1] === 'function') {
            const originalCallback = args[args.length - 1];
            args[args.length - 1] = function(...callbackArgs) {
              const latency = performance.now() - window.__MFE_EVENT_LATENCY_MAP.get(messageId).startTime;
              window.__MFE_PERFORMANCE.metrics.messageLatency.push({
                event,
                latency,
                roundTrip: true,
                timestamp: performance.now() - window.__MFE_PERFORMANCE.startTime
              });
              return originalCallback(...callbackArgs);
            };
            window.__MFE_EVENT_LATENCY_MAP.get(messageId).roundTrip = true;
          }
        }
        
        const result = originalEmit.apply(this, [event, ...args]);
        
        // Record end time for non-roundtrip events
        setTimeout(() => {
          window.__MFE_EVENT_LATENCY_MAP.forEach((data, id) => {
            if (!data.roundTrip && data.event === event) {
              const latency = performance.now() - data.startTime;
              window.__MFE_PERFORMANCE.metrics.messageLatency.push({
                event: data.event,
                latency,
                roundTrip: false,
                timestamp: performance.now() - window.__MFE_PERFORMANCE.startTime
              });
              window.__MFE_EVENT_LATENCY_MAP.delete(id);
            }
          });
        }, 0);
        
        return result;
      };
    }
  }
  
  /**
   * Register layout shift observer
   */
  function registerLayoutShiftObserver() {
    if (!('PerformanceObserver' in window)) return;
    
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
            window.__MFE_PERFORMANCE.metrics.layoutShifts += entry.value;
          }
        }
      });
      
      observer.observe({ type: 'layout-shift', buffered: true });
      
      // Store for cleanup
      window.__MFE_PERFORMANCE.layoutShiftObserver = observer;
    } catch (e) {
      console.error('Layout Shift observer error:', e);
    }
  }
  
/**
 * Collect network metrics
 */
function collectNetworkMetrics() {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'resource') {
            window.__MFE_PERFORMANCE.metrics.networkRequests++;
            window.__MFE_PERFORMANCE.metrics.totalTransferSize += entry.transferSize || 0;
          }
        });
      });
      
      observer.observe({ entryTypes: ['resource'] });
      
      // Store for cleanup
      window.__MFE_PERFORMANCE.resourceObserver = observer;
    } catch (e) {
      console.error('Resource observer error:', e);
    }
  }
  
  /**
   * Mark a performance event
   */
  export function markPerformanceEvent(name) {
    if (!window.__MFE_PERFORMANCE) return;
    
    performance.mark(`mfe-${name}`);
    window.__MFE_PERFORMANCE.marks[name] = performance.now() - window.__MFE_PERFORMANCE.startTime;
    
    // Special handling for first paint and time to interactive
    if (name === 'first-paint') {
      window.__MFE_PERFORMANCE.metrics.timeToFirstPaint = window.__MFE_PERFORMANCE.marks[name];
    } else if (name === 'interactive') {
      window.__MFE_PERFORMANCE.metrics.timeToInteractive = window.__MFE_PERFORMANCE.marks[name];
    } else if (name === 'initial-load-complete') {
      window.__MFE_PERFORMANCE.metrics.initialLoadTime = window.__MFE_PERFORMANCE.marks[name];
    }
  }
  
  /**
   * Stop performance measurements and return results
   */
  export function stopPerformanceMeasurement() {
    if (!window.__MFE_PERFORMANCE) return null;
    
    // Clear all intervals
    clearInterval(window.__MFE_PERFORMANCE.memoryInterval);
    clearInterval(window.__MFE_PERFORMANCE.frameRateInterval);
    
    // Disconnect observers
    if (window.__MFE_PERFORMANCE.layoutShiftObserver) {
      window.__MFE_PERFORMANCE.layoutShiftObserver.disconnect();
    }
    
    if (window.__MFE_PERFORMANCE.resourceObserver) {
      window.__MFE_PERFORMANCE.resourceObserver.disconnect();
    }
    
    // Calculate overall metrics
    const results = {
      mode: window.__MFE_PERFORMANCE.mode,
      initialLoad: {
        initialLoadTime: window.__MFE_PERFORMANCE.metrics.initialLoadTime,
        timeToFirstPaint: window.__MFE_PERFORMANCE.metrics.timeToFirstPaint,
        timeToInteractive: window.__MFE_PERFORMANCE.metrics.timeToInteractive
      },
      runtime: {
        averageMemoryUsage: calculateAverageMemory(window.__MFE_PERFORMANCE.metrics.memoryUsage),
        peakMemoryUsage: calculatePeakMemory(window.__MFE_PERFORMANCE.metrics.memoryUsage),
        averageFrameRate: calculateAverageFrameRate(window.__MFE_PERFORMANCE.metrics.frameRates),
        layoutShiftScore: window.__MFE_PERFORMANCE.metrics.layoutShifts
      },
      communication: {
        averageMessageLatency: calculateAverageLatency(window.__MFE_PERFORMANCE.metrics.messageLatency),
        messageCount: window.__MFE_PERFORMANCE.metrics.messageLatency.length
      },
      resources: {
        networkRequests: window.__MFE_PERFORMANCE.metrics.networkRequests,
        totalTransferSize: window.__MFE_PERFORMANCE.metrics.totalTransferSize
      },
      marks: window.__MFE_PERFORMANCE.marks,
      rawData: window.__MFE_PERFORMANCE.metrics
    };
    
    // Clean up global reference
    const performanceData = window.__MFE_PERFORMANCE;
    delete window.__MFE_PERFORMANCE;
    delete window.__MFE_EVENT_LATENCY_MAP;
    
    return results;
  }
  
  /**
   * Helper functions to calculate aggregate metrics
   */
  function calculateAverageMemory(memoryData) {
    if (!memoryData.length) return null;
    
    const sum = memoryData.reduce((acc, item) => acc + item.usedJSHeapSize, 0);
    return sum / memoryData.length;
  }
  
  function calculatePeakMemory(memoryData) {
    if (!memoryData.length) return null;
    
    return Math.max(...memoryData.map(item => item.usedJSHeapSize));
  }
  
  function calculateAverageFrameRate(frameRateData) {
    if (!frameRateData.length) return null;
    
    const sum = frameRateData.reduce((acc, item) => acc + item.fps, 0);
    return sum / frameRateData.length;
  }
  
  function calculateAverageLatency(latencyData) {
    if (!latencyData.length) return null;
    
    const sum = latencyData.reduce((acc, item) => acc + item.latency, 0);
    return sum / latencyData.length;
  }
  
  /**
   * Record state update latency
   */
  export function recordStateUpdateLatency(startTime, stateName) {
    if (!window.__MFE_PERFORMANCE) return;
    
    const latency = performance.now() - startTime;
    window.__MFE_PERFORMANCE.metrics.stateUpdateLatency.push({
      stateName,
      latency,
      timestamp: performance.now() - window.__MFE_PERFORMANCE.startTime
    });
  }
  
  /**
   * Compare performance between iframe and web component modes
   */
  export function comparePerformance(iframeResults, webComponentResults) {
    if (!iframeResults || !webComponentResults) return null;
    
    return {
      initialLoad: {
        initialLoadTime: {
          iframe: iframeResults.initialLoad.initialLoadTime,
          webComponent: webComponentResults.initialLoad.initialLoadTime,
          difference: webComponentResults.initialLoad.initialLoadTime - iframeResults.initialLoad.initialLoadTime,
          percentageDifference: calculatePercentageDifference(
            webComponentResults.initialLoad.initialLoadTime,
            iframeResults.initialLoad.initialLoadTime
          )
        },
        timeToFirstPaint: {
          iframe: iframeResults.initialLoad.timeToFirstPaint,
          webComponent: webComponentResults.initialLoad.timeToFirstPaint,
          difference: webComponentResults.initialLoad.timeToFirstPaint - iframeResults.initialLoad.timeToFirstPaint,
          percentageDifference: calculatePercentageDifference(
            webComponentResults.initialLoad.timeToFirstPaint,
            iframeResults.initialLoad.timeToFirstPaint
          )
        },
        timeToInteractive: {
          iframe: iframeResults.initialLoad.timeToInteractive,
          webComponent: webComponentResults.initialLoad.timeToInteractive,
          difference: webComponentResults.initialLoad.timeToInteractive - iframeResults.initialLoad.timeToInteractive,
          percentageDifference: calculatePercentageDifference(
            webComponentResults.initialLoad.timeToInteractive,
            iframeResults.initialLoad.timeToInteractive
          )
        }
      },
      runtime: {
        averageMemoryUsage: {
          iframe: iframeResults.runtime.averageMemoryUsage,
          webComponent: webComponentResults.runtime.averageMemoryUsage,
          difference: webComponentResults.runtime.averageMemoryUsage - iframeResults.runtime.averageMemoryUsage,
          percentageDifference: calculatePercentageDifference(
            webComponentResults.runtime.averageMemoryUsage,
            iframeResults.runtime.averageMemoryUsage
          )
        },
        peakMemoryUsage: {
          iframe: iframeResults.runtime.peakMemoryUsage,
          webComponent: webComponentResults.runtime.peakMemoryUsage,
          difference: webComponentResults.runtime.peakMemoryUsage - iframeResults.runtime.peakMemoryUsage,
          percentageDifference: calculatePercentageDifference(
            webComponentResults.runtime.peakMemoryUsage,
            iframeResults.runtime.peakMemoryUsage
          )
        },
        averageFrameRate: {
          iframe: iframeResults.runtime.averageFrameRate,
          webComponent: webComponentResults.runtime.averageFrameRate,
          difference: webComponentResults.runtime.averageFrameRate - iframeResults.runtime.averageFrameRate,
          percentageDifference: calculatePercentageDifference(
            webComponentResults.runtime.averageFrameRate,
            iframeResults.runtime.averageFrameRate
          )
        },
        layoutShiftScore: {
          iframe: iframeResults.runtime.layoutShiftScore,
          webComponent: webComponentResults.runtime.layoutShiftScore,
          difference: webComponentResults.runtime.layoutShiftScore - iframeResults.runtime.layoutShiftScore,
          percentageDifference: calculatePercentageDifference(
            webComponentResults.runtime.layoutShiftScore,
            iframeResults.runtime.layoutShiftScore
          )
        }
      },
      communication: {
        averageMessageLatency: {
          iframe: iframeResults.communication.averageMessageLatency,
          webComponent: webComponentResults.communication.averageMessageLatency,
          difference: webComponentResults.communication.averageMessageLatency - iframeResults.communication.averageMessageLatency,
          percentageDifference: calculatePercentageDifference(
            webComponentResults.communication.averageMessageLatency,
            iframeResults.communication.averageMessageLatency
          )
        },
        messageCount: {
          iframe: iframeResults.communication.messageCount,
          webComponent: webComponentResults.communication.messageCount
        }
      },
      resources: {
        networkRequests: {
          iframe: iframeResults.resources.networkRequests,
          webComponent: webComponentResults.resources.networkRequests,
          difference: webComponentResults.resources.networkRequests - iframeResults.resources.networkRequests
        },
        totalTransferSize: {
          iframe: iframeResults.resources.totalTransferSize,
          webComponent: webComponentResults.resources.totalTransferSize,
          difference: webComponentResults.resources.totalTransferSize - iframeResults.resources.totalTransferSize,
          percentageDifference: calculatePercentageDifference(
            webComponentResults.resources.totalTransferSize,
            iframeResults.resources.totalTransferSize
          )
        }
      }
    };
  }
  
  /**
   * Calculate percentage difference between two values
   */
  function calculatePercentageDifference(valueA, valueB) {
    if (valueB === 0) return null;
    return ((valueA - valueB) / valueB) * 100;
  }