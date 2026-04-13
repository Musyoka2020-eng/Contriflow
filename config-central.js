/**
 * Central Firebase Configuration
 * 
 * This is the central Firestore database used for:
 * - Organization metadata
 * - User authentication and profiles
 * - User-organization memberships
 * - Super admin operations
 * 
 * Each organization also has its own isolated Realtime Database
 * 
 * CONFIG LOADING:
 * - At build time, build.js generates config-generated.js from environment variables
 * - This file loads that generated config (or falls back to defaults)
 * 
 * SECURITY NOTE:
 * - Firebase API keys are public (they identify the project, not authenticate)
 * - Real user authentication happens via Firebase Auth
 * - Firestore security rules restrict database access
 */

// Try to load the generated config (created by build.js)
// If not available, use defaults
let CENTRAL_FIREBASE_CONFIG = {
  apiKey: "DEFAULT_API_KEY_PLACEHOLDER",
  authDomain: "universal-contribution-manager.firebaseapp.com",
  projectId: "universal-contribution-manager",
  storageBucket: "universal-contribution-manager.firebasestorage.app",
  messagingSenderId: "10877815438",
  appId: "1:10877815438:web:62bf12fcc99ccead3fd7df",
  measurementId: "G-ZEBML1MZQ6"
};

// Check if generated config is available (loaded via script tag in HTML)
if (typeof GENERATED_FIREBASE_CONFIG !== 'undefined') {
  CENTRAL_FIREBASE_CONFIG = GENERATED_FIREBASE_CONFIG;
}

// Central Firebase initialization
let centralApp = null;
let centralFirestore = null;
let centralAuth = null;

function initializeCentralFirebase() {
  try {
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase SDK not loaded');
    }

    centralApp = firebase.initializeApp(CENTRAL_FIREBASE_CONFIG);
    centralFirestore = firebase.firestore(centralApp);
    
    // Initialize Auth using compat API
    // In compat version, firebase.auth() returns the default app's auth instance
    try {
      if (typeof firebase.auth === 'function') {
        centralAuth = firebase.auth();
      } else if (centralApp && centralApp.auth && typeof centralApp.auth === 'function') {
        centralAuth = centralApp.auth();
      } else {
        // Auth not available - this is OK, Firestore can still work
        centralAuth = null;
      }
    } catch (authError) {
      // Auth initialization failed - silently continue since it's optional
      centralAuth = null;
    }

    // Firebase initialized (even if auth failed, we have Firestore)
    return {
      app: centralApp,
      db: centralFirestore,
      auth: centralAuth
    };
  } catch (error) {
    console.error('Failed to initialize Central Firebase:', error);
    throw error;
  }
}

function getCentralFirestore() {
  return centralFirestore;
}

function getCentralAuth() {
  return centralAuth;
}

function getCentralApp() {
  return centralApp;
}
