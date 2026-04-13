import ServiceContainer from './service-container.js';

/**
 * Application Initializer
 * Sets up the entire application with ServiceContainer
 * Handles Firebase initialization and service wiring
 * 
 * Usage in HTML:
 *   <script type="module">
 *     import { initializeApp } from './js/core/app-initializer.js';
 *     window.addEventListener('DOMContentLoaded', initializeApp);
 *   </script>
 */

/**
 * Initialize the entire application
 * Call this once when the app loads (DOMContentLoaded)
 */
export async function initializeApp() {
  try {
    console.log('[App] Initializing application...');

    // First, ensure Firebase is initialized
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase SDK not loaded. Ensure firebase scripts are loaded before app-initializer.');
    }

    // Initialize Firebase using config-central.js
    // The function name should match what's exported from config-central.js
    let centralAuth, centralFirestore;
    
    if (typeof initializeCentralFirebase === 'function') {
      // Use the config-central initialization
      const fbConfig = initializeCentralFirebase();
      centralAuth = fbConfig.auth;
      centralFirestore = fbConfig.db;
    } else {
      // Fallback to global instances set by config-central.js
      centralAuth = window.firebaseAuth;
      centralFirestore = window.firebaseDb;
    }

    if (!centralFirestore) {
      throw new Error('Firebase Firestore not initialized. Check config-central.js');
    }

    // Also expose to window for backward compatibility
    window.firebaseAuth = centralAuth;
    window.firebaseDb = centralFirestore;

    // Initialize ServiceContainer (handles all service setup)
    const container = ServiceContainer.getInstance();
    await container.initialize(centralAuth, centralFirestore);

    // Expose services to global scope for pages that need them
    window.appServices = {
      container: container,
      firebaseService: container.getFirebaseService(),
      authService: container.getAuthService(),
      orgManager: container.getOrgManager(),
      superAdminService: container.getSuperAdminService(),
      stateManager: container.getStateManager(),
      centralAuth: centralAuth,
      centralFirestore: centralFirestore
    };

    console.log('[App] Application initialized successfully ✓');
    console.log('[App] Services available at window.appServices');

    // Dispatch custom event so pages know app is ready
    const appReadyEvent = new CustomEvent('appReady', { detail: { services: window.appServices } });
    window.dispatchEvent(appReadyEvent);

    return window.appServices;
  } catch (error) {
    console.error('[App] Failed to initialize application:', error);
    
    // Show user-friendly error
    if (typeof Swal !== 'undefined') {
      await Swal.fire({
        icon: 'error',
        title: 'Initialization Failed',
        text: error.message || 'Failed to initialize the application. Please refresh the page.',
        allowOutsideClick: false,
        confirmButtonText: 'Refresh'
      });
    } else {
      alert('Failed to initialize the application: ' + (error.message || 'Unknown error'));
    }

    throw error;
  }
}

/**
 * Utility: Get services after app is initialized
 * Use this in page scripts to access services
 * 
 * Example:
 *   const services = getAppServices();
 *   await services.authService.signIn(email, password);
 */
export function getAppServices() {
  if (!window.appServices) {
    throw new Error('Application not initialized. Ensure app-initializer.js runs before this.');
  }
  return window.appServices;
}

/**
 * Utility: Wait for app to be ready
 * Use this if you need to ensure initialization completes before running code
 * 
 * Example:
 *   await waitForAppReady();
 *   const { authService } = window.appServices;
 */
export function waitForAppReady() {
  return new Promise((resolve, reject) => {
    if (window.appServices) {
      resolve(window.appServices);
    } else {
      const timeout = setTimeout(() => {
        reject(new Error('App initialization timeout'));
      }, 10000); // 10 second timeout

      window.addEventListener('appReady', (event) => {
        clearTimeout(timeout);
        resolve(event.detail.services);
      }, { once: true });
    }
  });
}

/**
 * Graceful shutdown (optional)
 * Call before navigating away to clean up listeners
 */
export function shutdownApp() {
  if (window.appServices) {
    const { stateManager } = window.appServices;
    // Services will clean themselves up
    delete window.appServices;
    console.log('[App] Application shutdown');
  }
}
// Auto-initialize when loaded as module
function startInitialization() {
  // Check if Firebase SDK and config are ready
  const maxWaitTime = 5000; // 5 seconds max
  const startTime = Date.now();
  
  const checkAndInit = () => {
    // Check if Firebase SDK is available and config function exists
    if (typeof firebase !== 'undefined' && typeof initializeCentralFirebase === 'function') {
      // Both are ready, initialize
      initializeApp().catch((error) => {
        console.error('[App] Initialization failed:', error);
      });
    } else if (Date.now() - startTime < maxWaitTime) {
      // Not ready yet, try again in 10ms
      setTimeout(checkAndInit, 10);
    } else {
      // Timeout - Firebase or config not ready
      const error = new Error('Firebase SDK or configuration not loaded in time');
      console.error('[App]', error.message);
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Initialization Timeout',
          text: 'Failed to load Firebase. Please refresh the page.',
          confirmButtonText: 'Refresh'
        });
      }
    }
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndInit);
  } else {
    checkAndInit();
  }
}

startInitialization();