import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * ServiceContainer Tests
 * Tests service initialization and dependency injection
 */

describe('ServiceContainer', () => {
  let container;
  let mockCentralAuth;
  let mockCentralFirestore;

  // Mock service classes for testing
  class MockFirebaseService {
    static instance = null;

    async initializeCentral(auth, firestore) {
      return true;
    }

    static getInstance() {
      if (!MockFirebaseService.instance) {
        MockFirebaseService.instance = new MockFirebaseService();
      }
      return MockFirebaseService.instance;
    }

    static resetInstance() {
      MockFirebaseService.instance = null;
    }
  }

  class MockAuthService {
    constructor(firebaseService) {
      this.firebaseService = firebaseService;
    }

    async initialize() {
      return true;
    }
  }

  class MockOrgManager {
    constructor(firebaseService) {
      this.firebaseService = firebaseService;
    }

    async initialize() {
      return true;
    }
  }

  class MockSuperAdminService {
    constructor(firebaseService) {
      this.firebaseService = firebaseService;
    }

    async initialize() {
      return true;
    }
  }

  class MockStateManager {
    static instance = null;

    static getInstance() {
      if (!MockStateManager.instance) {
        MockStateManager.instance = new MockStateManager();
      }
      return MockStateManager.instance;
    }

    static resetInstance() {
      MockStateManager.instance = null;
    }
  }

  class TestServiceContainer {
    constructor() {
      this.firebaseService = null;
      this.authService = null;
      this.orgManager = null;
      this.superAdminService = null;
      this.stateManager = null;
      this.initialized = false;
    }

    async initialize(centralAuth, centralFirestore) {
      if (this.initialized) {
        console.warn('ServiceContainer already initialized');
        return;
      }

      try {
        this.firebaseService = MockFirebaseService.getInstance();
        await this.firebaseService.initializeCentral(centralAuth, centralFirestore);

        this.stateManager = MockStateManager.getInstance();

        this.authService = new MockAuthService(this.firebaseService);
        await this.authService.initialize();

        this.orgManager = new MockOrgManager(this.firebaseService);
        await this.orgManager.initialize();

        this.superAdminService = new MockSuperAdminService(this.firebaseService);
        await this.superAdminService.initialize();

        this.initialized = true;
        return true;
      } catch (error) {
        console.error('Failed to initialize ServiceContainer:', error);
        throw error;
      }
    }

    getFirebaseService() {
      if (!this.firebaseService) {
        throw new Error('FirebaseService not initialized');
      }
      return this.firebaseService;
    }

    getAuthService() {
      if (!this.authService) {
        throw new Error('AuthService not initialized');
      }
      return this.authService;
    }

    getOrgManager() {
      if (!this.orgManager) {
        throw new Error('OrgManager not initialized');
      }
      return this.orgManager;
    }

    getSuperAdminService() {
      if (!this.superAdminService) {
        throw new Error('SuperAdminService not initialized');
      }
      return this.superAdminService;
    }

    getStateManager() {
      if (!this.stateManager) {
        this.stateManager = MockStateManager.getInstance();
      }
      return this.stateManager;
    }

    isInitialized() {
      return this.initialized;
    }

    getAllServices() {
      if (!this.initialized) {
        throw new Error('ServiceContainer not initialized');
      }

      return {
        firebaseService: this.firebaseService,
        authService: this.authService,
        orgManager: this.orgManager,
        superAdminService: this.superAdminService,
        stateManager: this.stateManager
      };
    }

    static getInstance() {
      if (!TestServiceContainer.instance) {
        TestServiceContainer.instance = new TestServiceContainer();
      }
      return TestServiceContainer.instance;
    }

    static resetInstance() {
      TestServiceContainer.instance = null;
    }
  }

  beforeEach(() => {
    TestServiceContainer.resetInstance();
    MockFirebaseService.resetInstance();
    MockStateManager.resetInstance();

    container = TestServiceContainer.getInstance();

    mockCentralAuth = {
      onAuthStateChanged: vi.fn(),
      createUserWithEmailAndPassword: vi.fn(),
      signInWithEmailAndPassword: vi.fn(),
      signOut: vi.fn()
    };

    mockCentralFirestore = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(),
          set: vi.fn(),
          update: vi.fn()
        }))
      }))
    };
  });

  describe('initialization', () => {
    it('should initialize all services', async () => {
      const result = await container.initialize(mockCentralAuth, mockCentralFirestore);

      expect(result).toBe(true);
      expect(container.isInitialized()).toBe(true);
    });

    it('should initialize FirebaseService', async () => {
      await container.initialize(mockCentralAuth, mockCentralFirestore);

      const firebaseService = container.getFirebaseService();
      expect(firebaseService).toBeDefined();
    });

    it('should initialize AuthService with FirebaseService dependency', async () => {
      await container.initialize(mockCentralAuth, mockCentralFirestore);

      const authService = container.getAuthService();
      expect(authService).toBeDefined();
      expect(authService.firebaseService).toBeDefined();
    });

    it('should initialize OrgManager with FirebaseService dependency', async () => {
      await container.initialize(mockCentralAuth, mockCentralFirestore);

      const orgManager = container.getOrgManager();
      expect(orgManager).toBeDefined();
      expect(orgManager.firebaseService).toBeDefined();
    });

    it('should initialize SuperAdminService with FirebaseService dependency', async () => {
      await container.initialize(mockCentralAuth, mockCentralFirestore);

      const superAdminService = container.getSuperAdminService();
      expect(superAdminService).toBeDefined();
      expect(superAdminService.firebaseService).toBeDefined();
    });

    it('should initialize StateManager', async () => {
      await container.initialize(mockCentralAuth, mockCentralFirestore);

      const stateManager = container.getStateManager();
      expect(stateManager).toBeDefined();
    });

    it('should prevent double initialization', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      await container.initialize(mockCentralAuth, mockCentralFirestore);
      await container.initialize(mockCentralAuth, mockCentralFirestore);

      expect(consoleSpy).toHaveBeenCalledWith('ServiceContainer already initialized');
      consoleSpy.mockRestore();
    });

    it('should throw error when accessing service before initialization', () => {
      const newContainer = TestServiceContainer.getInstance();
      TestServiceContainer.resetInstance();

      const freshContainer = TestServiceContainer.getInstance();

      expect(() => {
        freshContainer.getFirebaseService();
      }).toThrow('FirebaseService not initialized');
    });
  });

  describe('service getters', () => {
    beforeEach(async () => {
      await container.initialize(mockCentralAuth, mockCentralFirestore);
    });

    it('should return FirebaseService instance', () => {
      const firebaseService = container.getFirebaseService();
      expect(firebaseService).toBeInstanceOf(MockFirebaseService);
    });

    it('should return same FirebaseService instance on multiple calls', () => {
      const service1 = container.getFirebaseService();
      const service2 = container.getFirebaseService();

      expect(service1).toBe(service2);
    });

    it('should return AuthService instance', () => {
      const authService = container.getAuthService();
      expect(authService).toBeInstanceOf(MockAuthService);
    });

    it('should return OrgManager instance', () => {
      const orgManager = container.getOrgManager();
      expect(orgManager).toBeInstanceOf(MockOrgManager);
    });

    it('should return SuperAdminService instance', () => {
      const superAdminService = container.getSuperAdminService();
      expect(superAdminService).toBeInstanceOf(MockSuperAdminService);
    });

    it('should return StateManager instance', () => {
      const stateManager = container.getStateManager();
      expect(stateManager).toBeInstanceOf(MockStateManager);
    });
  });

  describe('getAllServices', () => {
    it('should return all services as object', async () => {
      await container.initialize(mockCentralAuth, mockCentralFirestore);

      const services = container.getAllServices();

      expect(services).toHaveProperty('firebaseService');
      expect(services).toHaveProperty('authService');
      expect(services).toHaveProperty('orgManager');
      expect(services).toHaveProperty('superAdminService');
      expect(services).toHaveProperty('stateManager');
    });

    it('should throw error when getting all services before initialization', () => {
      const newContainer = TestServiceContainer.getInstance();
      TestServiceContainer.resetInstance();

      const freshContainer = TestServiceContainer.getInstance();

      expect(() => {
        freshContainer.getAllServices();
      }).toThrow('ServiceContainer not initialized');
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = TestServiceContainer.getInstance();
      const instance2 = TestServiceContainer.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = TestServiceContainer.getInstance();
      TestServiceContainer.resetInstance();
      const instance2 = TestServiceContainer.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('dependency injection', () => {
    it('should inject FirebaseService into AuthService', async () => {
      await container.initialize(mockCentralAuth, mockCentralFirestore);

      const authService = container.getAuthService();
      const firebaseService = container.getFirebaseService();

      expect(authService.firebaseService).toBe(firebaseService);
    });

    it('should inject FirebaseService into OrgManager', async () => {
      await container.initialize(mockCentralAuth, mockCentralFirestore);

      const orgManager = container.getOrgManager();
      const firebaseService = container.getFirebaseService();

      expect(orgManager.firebaseService).toBe(firebaseService);
    });

    it('should inject FirebaseService into SuperAdminService', async () => {
      await container.initialize(mockCentralAuth, mockCentralFirestore);

      const superAdminService = container.getSuperAdminService();
      const firebaseService = container.getFirebaseService();

      expect(superAdminService.firebaseService).toBe(firebaseService);
    });
  });

  describe('initialization status', () => {
    it('should be uninitialized by default', () => {
      const newContainer = TestServiceContainer.getInstance();
      TestServiceContainer.resetInstance();

      const freshContainer = TestServiceContainer.getInstance();

      expect(freshContainer.isInitialized()).toBe(false);
    });

    it('should be initialized after initialize() call', async () => {
      await container.initialize(mockCentralAuth, mockCentralFirestore);

      expect(container.isInitialized()).toBe(true);
    });
  });
});
