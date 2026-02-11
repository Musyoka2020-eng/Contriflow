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
 * SECURITY NOTE:
 * These values are injected at build time by Vercel from environment variables.
 * Never commit real credentials to git. Use Vercel's Environment Variables dashboard.
 */

const CENTRAL_FIREBASE_CONFIG = {
  apiKey: typeof process !== 'undefined' && process.env.FIREBASE_API_KEY 
    ? process.env.FIREBASE_API_KEY 
    : "DEFAULT_API_KEY_PLACEHOLDER",
  authDomain: typeof process !== 'undefined' && process.env.FIREBASE_AUTH_DOMAIN 
    ? process.env.FIREBASE_AUTH_DOMAIN 
    : "universal-contribution-manager.firebaseapp.com",
  projectId: typeof process !== 'undefined' && process.env.FIREBASE_PROJECT_ID 
    ? process.env.FIREBASE_PROJECT_ID 
    : "universal-contribution-manager",
  storageBucket: typeof process !== 'undefined' && process.env.FIREBASE_STORAGE_BUCKET 
    ? process.env.FIREBASE_STORAGE_BUCKET 
    : "universal-contribution-manager.firebasestorage.app",
  messagingSenderId: typeof process !== 'undefined' && process.env.FIREBASE_MESSAGING_SENDER_ID 
    ? process.env.FIREBASE_MESSAGING_SENDER_ID 
    : "10877815438",
  appId: typeof process !== 'undefined' && process.env.FIREBASE_APP_ID 
    ? process.env.FIREBASE_APP_ID 
    : "1:10877815438:web:62bf12fcc99ccead3fd7df",
  measurementId: typeof process !== 'undefined' && process.env.FIREBASE_MEASUREMENT_ID 
    ? process.env.FIREBASE_MEASUREMENT_ID 
    : "G-ZEBML1MZQ6"
};

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
    
    // Auth initialization is optional - only initialize if available
    if (typeof firebase.auth === 'function') {
      centralAuth = firebase.auth(centralApp);
    }

    // Firebase initialized
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
