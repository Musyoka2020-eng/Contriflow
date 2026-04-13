import FirebaseService from '../services/firebase-service.js';
import AuthService from '../services/auth-service.js';
import OrgManager from '../services/org-manager.js';
import SuperAdminService from '../services/super-admin-service.js';
import StateManager from './state-manager.js';

/**
 * Service Container
 * Initializes and manages all application services with dependency injection
 * 
 * Three-Tier Architecture:
 * 1. FirebaseService (Database Layer) - All Firebase operations
 * 2. Service Layer - Business logic (AuthService, OrgManager, SuperAdminService)
 * 3. State Layer - App state (StateManager)
 * 
 * Usage:
 *   const container = ServiceContainer.getInstance();
 *   await container.initialize(centralAuth, centralFirestore);
 *   const authService = container.getAuthService();
 *   const orgManager = container.getOrgManager();
 *   const stateManager = container.getStateManager();
 */

class ServiceContainer {
  constructor() {
    this.firebaseService = null;
    this.authService = null;
    this.orgManager = null;
    this.superAdminService = null;
    this.stateManager = null;
    this.initialized = false;
  }

  /**
   * Initialize all services
   * Must be called once at application startup
   * 
   * TODO: This method should be called from app initialization code
   * Currently services are instantiated without this being called
   */
  async initialize(centralAuth, centralFirestore) {
    if (this.initialized) {
      console.warn('ServiceContainer already initialized');
      return;
    }

    try {
      // 1. Initialize FirebaseService (Database Layer)
      this.firebaseService = FirebaseService.getInstance();
      await this.firebaseService.initializeCentral(centralAuth, centralFirestore);

      // 2. Initialize StateManager (State Layer)
      this.stateManager = StateManager.getInstance();

      // 3. Initialize Service Layer with dependencies
      // Services now also receive StateManager to update app state
      this.authService = new AuthService(this.firebaseService, null, this.stateManager);
      await this.authService.initialize();

      this.orgManager = new OrgManager(this.firebaseService, this.stateManager);
      await this.orgManager.initialize();

      this.superAdminService = new SuperAdminService(this.firebaseService);
      await this.superAdminService.initialize();

      this.initialized = true;
      console.log('ServiceContainer initialized successfully');

      return true;
    } catch (error) {
      console.error('Failed to initialize ServiceContainer:', error);
      throw error;
    }
  }

  /**
   * Get FirebaseService instance
   * All database operations go through this service
   */
  getFirebaseService() {
    if (!this.firebaseService) {
      throw new Error('FirebaseService not initialized. Call ServiceContainer.initialize() first');
    }
    return this.firebaseService;
  }

  /**
   * Get AuthService instance
   * Handles authentication and user management
   */
  getAuthService() {
    if (!this.authService) {
      throw new Error('AuthService not initialized. Call ServiceContainer.initialize() first');
    }
    return this.authService;
  }

  /**
   * Get OrgManager instance
   * Manages organization context and member operations
   */
  getOrgManager() {
    if (!this.orgManager) {
      throw new Error('OrgManager not initialized. Call ServiceContainer.initialize() first');
    }
    return this.orgManager;
  }

  /**
   * Get SuperAdminService instance
   * Handles organization creation and super admin operations
   */
  getSuperAdminService() {
    if (!this.superAdminService) {
      throw new Error('SuperAdminService not initialized. Call ServiceContainer.initialize() first');
    }
    return this.superAdminService;
  }

  /**
   * Get StateManager instance
   * Central app state management with listeners
   */
  getStateManager() {
    if (!this.stateManager) {
      this.stateManager = StateManager.getInstance();
    }
    return this.stateManager;
  }

  /**
   * Check if container is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get all services as an object
   * Useful for passing to components
   */
  getAllServices() {
    if (!this.initialized) {
      throw new Error('ServiceContainer not initialized. Call ServiceContainer.initialize() first');
    }

    return {
      firebaseService: this.firebaseService,
      authService: this.authService,
      orgManager: this.orgManager,
      superAdminService: this.superAdminService,
      stateManager: this.stateManager
    };
  }

  /**
   * Singleton pattern
   * Returns the same instance throughout the application
   */
  static getInstance() {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * Reset instance (useful for testing)
   */
  static resetInstance() {
    ServiceContainer.instance = null;
  }
}

export default ServiceContainer;
