<template>
  <div class="vue-child-app" style="height: 100%; width: 100%; overflow: auto;">
    <h2>Vue Child Application</h2>
    
    <div class="state-display">
      <div class="counter-section">
        <h3>State Management</h3>
        <p>Parent Counter: {{ parentCounter }}</p>
        <p>Local Counter: {{ localCounter }}</p>
        
        <div class="button-group">
          <button @click="incrementLocalCounter">
            Increment Local
          </button>
          <button @click="requestParentIncrement">
            Request Parent Increment
          </button>
        </div>
      </div>
      
      <!-- Other component parts... -->
    </div>
    
    <!-- More component parts... -->
  </div>
</template>
*/






<script>
import { initChildApp, StateManager } from 'simplified-mfe';

// Create local state manager
const localState = new StateManager({
  localCounter: 0
});

export default {
  name: 'VueChildApp',
  
  data() {
    return {
      mfeProps: {},
      parentCounter: 0,
      localCounter: 0,
      parentMessage: '',
      reactMessage: '',
      mfe: null
    };
  },
  
  created() {
    // Initialize the child app
    this.mfe = initChildApp({
      bootstrap: () => {
        console.log('Vue child app bootstrapped');
      },
      mount: () => {
        console.log('Vue child app mounted');
      },
      unmount: () => {
        console.log('Vue child app unmounted');
        return Promise.resolve();
      }
    });
    
    if (this.mfe) {
      // Store props
      this.mfeProps = this.mfe.props;
      
      // Connect local state to bus
      localState.connect('vue-child', this.mfe.bus);
      
      // Subscribe to local state changes
      localState.subscribe((state) => {
        this.localCounter = state.localCounter;
      });
      
      // Listen for parent state updates
      this.mfe.bus.$on('state:update:main', (state) => {
        if (state.counter !== undefined) {
          this.parentCounter = state.counter;
        }
      });
      
      // Listen for events from parent
      this.mfe.bus.$on('parent:action', (message) => {
        this.parentMessage = message;
      });
      
      // Listen for events from React sibling
      this.mfe.bus.$on('react-to-vue', (message) => {
        this.reactMessage = message;
      });
      
      // Get initial parent state if available
      this.mfe.bus.$emit('state:get:main');
    }
  },
  
  beforeUnmount() {
    if (this.mfe) {
      this.mfe.bus.$off('state:update:main');
      this.mfe.bus.$off('parent:action');
      this.mfe.bus.$off('react-to-vue');
    }
  },
  
  methods: {
    // Update local state and notify
    incrementLocalCounter() {
      const newValue = this.localCounter + 1;
      this.localCounter = newValue;
      localState.setState({ localCounter: newValue });
    },
    
    // Request parent to increment counter
    requestParentIncrement() {
      this.mfe.bus.$emit('counter:increment');
    },
    
    // Send message to parent
    sendMessageToParent() {
      this.mfe.bus.$emit('child:message', `Hello from Vue Child (${new Date().toLocaleTimeString()})`);
    },
    
    // Communicate with React sibling
    sendMessageToReactSibling() {
      this.mfe.bus.$emit('vue-to-react', `Message from Vue sibling (${new Date().toLocaleTimeString()})`);
    }
  }
}
</script>

<style scoped>
.vue-child-app {
  font-family: Arial, sans-serif;
  padding: 20px;
  border: 2px solid #42b983;
  border-radius: 5px;
  margin: 10px;
}

.state-display {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 20px;
}

.counter-section, .communication-section {
  flex: 1;
  min-width: 200px;
  padding: 15px;
  background-color: #f8f8f8;
  border-radius: 5px;
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

button {
  padding: 8px 12px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #369a6e;
}

.message {
  padding: 10px;
  margin-top: 10px;
  background-color: #e8f5e9;
  border-left: 4px solid #42b983;
}

.props-display {
  padding: 15px;
  background-color: #f0f4f8;
  border-radius: 5px;
}

pre {
  overflow-x: auto;
  background-color: #f1f1f1;
  padding: 10px;
  border-radius: 4px;
}
</style>