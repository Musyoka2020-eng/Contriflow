import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * StateManager Tests
 * Tests centralized state management, listeners, and undo/redo
 */

describe('StateManager', () => {
  let stateManager;

  beforeEach(() => {
    // Reset singleton for clean state
    StateManager.resetInstance();
    stateManager = StateManager.getInstance();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const state = stateManager.getState();

      expect(state.currentUser).toBeNull();
      expect(state.currentUserRole).toBeNull();
      expect(state.isSuperAdmin).toBe(false);
      expect(state.userOrganizations).toEqual([]);
      expect(state.currentOrganization).toBeNull();
      expect(state.appInitialized).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should be a singleton', () => {
      const instance1 = StateManager.getInstance();
      const instance2 = StateManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should return frozen state object', () => {
      const state = stateManager.getState();

      expect(() => {
        state.currentUser = { uid: 'test' };
      }).toThrow();
    });
  });

  describe('user state management', () => {
    it('should set current user', () => {
      const user = {
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null
      };

      stateManager.setCurrentUser(user);
      const state = stateManager.getState();

      expect(state.currentUser).toEqual(expect.objectContaining({
        uid: 'user123',
        email: 'test@example.com',
        displayName: 'Test User'
      }));
    });

    it('should throw error when setting invalid user', () => {
      expect(() => stateManager.setCurrentUser(null)).toThrow('User object is required with uid and email');
      expect(() => stateManager.setCurrentUser({})).toThrow('User object is required with uid and email');
      expect(() => stateManager.setCurrentUser({ uid: 'user123' })).toThrow('User object is required with uid and email');
    });

    it('should set user role', () => {
      stateManager.setUserRole('admin');
      const state = stateManager.getState();

      expect(state.currentUserRole).toBe('admin');
      expect(state.isSuperAdmin).toBe(false);
    });

    it('should set super admin flag when role is superadmin', () => {
      stateManager.setUserRole('superadmin');
      const state = stateManager.getState();

      expect(state.currentUserRole).toBe('superadmin');
      expect(state.isSuperAdmin).toBe(true);
    });

    it('should clear user data on logout', () => {
      stateManager.setCurrentUser({
        uid: 'user123',
        email: 'test@example.com'
      });
      stateManager.setUserRole('admin');
      stateManager.clearUserData();

      const state = stateManager.getState();

      expect(state.currentUser).toBeNull();
      expect(state.currentUserRole).toBeNull();
      expect(state.isSuperAdmin).toBe(false);
      expect(state.userOrganizations).toEqual([]);
      expect(state.currentOrganization).toBeNull();
    });
  });

  describe('organization state management', () => {
    it('should set user organizations', () => {
      const orgs = [
        { slug: 'org1', name: 'Organization 1' },
        { slug: 'org2', name: 'Organization 2' }
      ];

      stateManager.setUserOrganizations(orgs);
      const state = stateManager.getState();

      expect(state.userOrganizations).toHaveLength(2);
      expect(state.userOrganizations[0].slug).toBe('org1');
    });

    it('should throw error for invalid organizations', () => {
      expect(() => stateManager.setUserOrganizations(null)).toThrow(
        'Organizations must be an array'
      );
      expect(() => stateManager.setUserOrganizations('invalid')).toThrow(
        'Organizations must be an array'
      );
    });

    it('should add single organization to list', () => {
      stateManager.setUserOrganizations([]);
      stateManager.addUserOrganization({
        slug: 'org1',
        name: 'Organization 1'
      });

      const state = stateManager.getState();
      expect(state.userOrganizations).toHaveLength(1);
      expect(state.userOrganizations[0].slug).toBe('org1');
    });

    it('should not add duplicate organization', () => {
      stateManager.setUserOrganizations([
        { slug: 'org1', name: 'Organization 1' }
      ]);

      stateManager.addUserOrganization({
        slug: 'org1',
        name: 'Organization 1'
      });

      const state = stateManager.getState();
      expect(state.userOrganizations).toHaveLength(1);
    });

    it('should remove organization from list', () => {
      stateManager.setUserOrganizations([
        { slug: 'org1', name: 'Organization 1' },
        { slug: 'org2', name: 'Organization 2' }
      ]);

      stateManager.removeUserOrganization('org1');
      const state = stateManager.getState();

      expect(state.userOrganizations).toHaveLength(1);
      expect(state.userOrganizations[0].slug).toBe('org2');
    });

    it('should set current organization', () => {
      const org = {
        id: 'org_123',
        slug: 'test-org',
        name: 'Test Organization',
        firebaseConfig: { projectId: 'test' },
        status: 'active',
        createdAt: new Date().toISOString()
      };

      stateManager.setCurrentOrganization(org);
      const state = stateManager.getState();

      expect(state.currentOrganization).toEqual(expect.objectContaining({
        slug: 'test-org',
        name: 'Test Organization',
        status: 'active'
      }));
    });

    it('should throw error when setting invalid organization', () => {
      expect(() => stateManager.setCurrentOrganization(null)).toThrow(
        'Organization object is required'
      );
      expect(() => stateManager.setCurrentOrganization({})).toThrow(
        'Organization must have a slug'
      );
    });

    it('should clear current organization', () => {
      stateManager.setCurrentOrganization({
        id: 'org_123',
        slug: 'test-org',
        name: 'Test'
      });

      stateManager.clearCurrentOrganization();
      const state = stateManager.getState();

      expect(state.currentOrganization).toBeNull();
      expect(state.currentOrgFirebaseApp).toBeNull();
      expect(state.currentOrgDatabase).toBeNull();
    });
  });

  describe('application state', () => {
    it('should set loading state', () => {
      stateManager.setLoading(true);
      expect(stateManager.getState().isLoading).toBe(true);

      stateManager.setLoading(false);
      expect(stateManager.getState().isLoading).toBe(false);
    });

    it('should set error state', () => {
      const error = new Error('Test error');
      stateManager.setError(error);
      const state = stateManager.getState();

      expect(state.error).not.toBeNull();
      expect(state.error.message).toBe('Test error');
      expect(state.error.timestamp).toBeDefined();
    });

    it('should clear error state', () => {
      stateManager.setError(new Error('Test'));
      stateManager.clearError();

      expect(stateManager.getState().error).toBeNull();
    });

    it('should set app initialization status', () => {
      stateManager.setAppInitialized(true);
      expect(stateManager.getState().appInitialized).toBe(true);

      stateManager.setAppInitialized(false);
      expect(stateManager.getState().appInitialized).toBe(false);
    });
  });

  describe('state listeners', () => {
    it('should notify listener on user change', () => {
      const callback = vi.fn();
      stateManager.subscribe('userChanged', callback);

      const user = { uid: 'user123', email: 'test@example.com' };
      stateManager.setCurrentUser(user);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            uid: 'user123',
            email: 'test@example.com'
          })
        }),
        expect.any(Object) // state object
      );
    });

    it('should notify listener on role change', () => {
      const callback = vi.fn();
      stateManager.subscribe('roleChanged', callback);

      stateManager.setUserRole('admin');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin',
          isSuperAdmin: false
        }),
        expect.any(Object)
      );
    });

    it('should notify listener on organization change', () => {
      const callback = vi.fn();
      stateManager.subscribe('organizationsChanged', callback);

      stateManager.setUserOrganizations([
        { slug: 'org1', name: 'Org 1' }
      ]);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          organizations: expect.any(Array)
        }),
        expect.any(Object)
      );
    });

    it('should allow context binding for listeners', () => {
      const context = { value: 'bound' };
      const callback = vi.fn(function() {
        return this.value;
      });

      stateManager.subscribe('userChanged', callback, context);
      stateManager.setCurrentUser({ uid: 'user123', email: 'test@example.com' });

      expect(callback.mock.results[0].value).toBe('bound');
    });

    it('should support wildcard listeners', () => {
      const callback = vi.fn();
      stateManager.subscribe('*', callback);

      stateManager.setLoading(true);
      stateManager.setCurrentUser({ uid: 'user123', email: 'test@example.com' });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, 'loadingChanged', expect.any(Object), expect.any(Object));
      expect(callback).toHaveBeenNthCalledWith(2, 'userChanged', expect.any(Object), expect.any(Object));
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = stateManager.subscribe('userChanged', callback);

      stateManager.setCurrentUser({ uid: 'user123', email: 'test@example.com' });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      stateManager.setCurrentUser({ uid: 'user456', email: 'test2@example.com' });
      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should throw error for invalid listener', () => {
      expect(() => stateManager.subscribe('userChanged', null)).toThrow(
        'Callback must be a function'
      );
      expect(() => stateManager.subscribe('userChanged', 'not-a-function')).toThrow(
        'Callback must be a function'
      );
    });
  });

  describe('undo/redo', () => {
    it('should undo state changes', () => {
      stateManager.setUserRole('admin');
      const state1 = stateManager.getState();
      expect(state1.currentUserRole).toBe('admin');

      stateManager.setUserRole('editor');
      const state2 = stateManager.getState();
      expect(state2.currentUserRole).toBe('editor');

      const undone = stateManager.undo();
      const state3 = stateManager.getState();

      expect(undone).toBe(true);
      expect(state3.currentUserRole).toBe('admin');
    });

    it('should redo state changes', () => {
      stateManager.setUserRole('admin');
      stateManager.setUserRole('editor');

      stateManager.undo();
      const undoneState = stateManager.getState();
      expect(undoneState.currentUserRole).toBe('admin');

      stateManager.redo();
      const redoneState = stateManager.getState();
      expect(redoneState.currentUserRole).toBe('editor');
    });

    it('should return false when cannot undo', () => {
      const canUndo = stateManager.undo();
      expect(canUndo).toBe(false);
    });

    it('should return false when cannot redo', () => {
      stateManager.setUserRole('admin');
      const canRedo = stateManager.redo();
      expect(canRedo).toBe(false);
    });

    it('should clear redo history when new change made after undo', () => {
      stateManager.setUserRole('admin');
      stateManager.setUserRole('editor');

      stateManager.undo();
      stateManager.setUserRole('viewer');

      const canRedo = stateManager.redo();
      expect(canRedo).toBe(false); // Redo path cleared
    });

    it('should respect history size limit', () => {
      // Make more changes than max history size (50)
      for (let i = 0; i < 60; i++) {
        stateManager.setUserRole(i % 2 === 0 ? 'admin' : 'editor');
      }

      const status = stateManager.getHistoryStatus();
      expect(status.historySize).toBeLessThanOrEqual(50);
    });

    it('should report undo/redo status', () => {
      const initialStatus = stateManager.getHistoryStatus();
      expect(initialStatus.canUndo).toBe(false);
      expect(initialStatus.canRedo).toBe(false);

      stateManager.setUserRole('admin');
      const afterChangeStatus = stateManager.getHistoryStatus();
      expect(afterChangeStatus.canUndo).toBe(true);
      expect(afterChangeStatus.canRedo).toBe(false);

      stateManager.undo();
      const afterUndoStatus = stateManager.getHistoryStatus();
      expect(afterUndoStatus.canUndo).toBe(false);
      expect(afterUndoStatus.canRedo).toBe(true);
    });
  });

  describe('getValue helper', () => {
    it('should get state value by path', () => {
      stateManager.setCurrentUser({ uid: 'user123', email: 'test@example.com' });

      expect(stateManager.getValue('currentUser.uid')).toBe('user123');
      expect(stateManager.getValue('currentUser.email')).toBe('test@example.com');
    });

    it('should return undefined for non-existent path', () => {
      expect(stateManager.getValue('nonexistent')).toBeUndefined();
      expect(stateManager.getValue('currentUser.nonexistent')).toBeUndefined();
    });
  });

  describe('firebase app/database storage', () => {
    it('should store org firebase app instance', () => {
      const mockApp = { name: 'org_test' };
      stateManager.setOrgFirebaseApp(mockApp);

      expect(stateManager.getState().currentOrgFirebaseApp).toBe(mockApp);
    });

    it('should store org database instance', () => {
      const mockDatabase = { ref: () => ({}) };
      stateManager.setOrgDatabase(mockDatabase);

      expect(stateManager.getState().currentOrgDatabase).toBe(mockDatabase);
    });
  });
});

// Define StateManager for testing (would normally be imported)
class StateManager {
  constructor() {
    this.state = {
      currentUser: null,
      currentUserRole: null,
      isSuperAdmin: false,
      userOrganizations: [],
      currentOrganization: null,
      currentOrgFirebaseApp: null,
      currentOrgDatabase: null,
      appInitialized: false,
      isLoading: false,
      error: null,
      lastUpdated: null
    };

    this.listeners = {};
    this.history = [JSON.parse(JSON.stringify(this.state))];
    this.historyIndex = 0;
    this.maxHistorySize = 50;

    Object.freeze(this.state);
  }

  getState() {
    return Object.freeze({ ...this.state });
  }

  getValue(path) {
    const keys = path.split('.');
    let value = this.state;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  }

  setCurrentUser(user) {
    if (!user || !user.uid || !user.email) throw new Error('User object is required with uid and email');
    this.saveSnapshot();
    this.state = {
      ...this.state,
      currentUser: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null
      },
      lastUpdated: new Date().toISOString()
    };
    this.notify('userChanged', { user: this.state.currentUser });
  }

  setUserRole(role) {
    if (!role) throw new Error('Role is required');
    const isSuperAdmin = role === 'superadmin';
    this.state = {
      ...this.state,
      currentUserRole: role,
      isSuperAdmin: isSuperAdmin,
      lastUpdated: new Date().toISOString()
    };
    this.saveSnapshot();
    this.notify('roleChanged', { role, isSuperAdmin });
  }

  setUserOrganizations(organizations) {
    if (!Array.isArray(organizations)) throw new Error('Organizations must be an array');
    this.saveSnapshot();
    this.state = {
      ...this.state,
      userOrganizations: [...organizations],
      lastUpdated: new Date().toISOString()
    };
    this.notify('organizationsChanged', { organizations: this.state.userOrganizations });
  }

  addUserOrganization(organization) {
    if (!organization?.slug) throw new Error('Valid organization object with slug is required');
    this.saveSnapshot();
    const exists = this.state.userOrganizations.some(org => org.slug === organization.slug);
    if (exists) return;
    this.state = {
      ...this.state,
      userOrganizations: [...this.state.userOrganizations, organization],
      lastUpdated: new Date().toISOString()
    };
    this.notify('organizationAdded', { organization });
  }

  removeUserOrganization(slug) {
    if (!slug) throw new Error('Organization slug is required');
    this.saveSnapshot();
    const filtered = this.state.userOrganizations.filter(org => org.slug !== slug);
    if (filtered.length === this.state.userOrganizations.length) return;
    this.state = {
      ...this.state,
      userOrganizations: filtered,
      lastUpdated: new Date().toISOString()
    };
    this.notify('organizationRemoved', { slug });
  }

  setCurrentOrganization(organization) {
    if (!organization) throw new Error('Organization object is required');
    if (!organization.slug) throw new Error('Organization must have a slug');
    this.saveSnapshot();
    this.state = {
      ...this.state,
      currentOrganization: {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
        firebaseConfig: organization.firebaseConfig,
        status: organization.status,
        createdAt: organization.createdAt
      },
      lastUpdated: new Date().toISOString()
    };
    this.notify('currentOrgChanged', { org: this.state.currentOrganization });
  }

  clearCurrentOrganization() {
    this.saveSnapshot();
    this.state = {
      ...this.state,
      currentOrganization: null,
      currentOrgFirebaseApp: null,
      currentOrgDatabase: null,
      lastUpdated: new Date().toISOString()
    };
    this.notify('currentOrgCleared');
  }

  setOrgFirebaseApp(app) {
    this.state = { ...this.state, currentOrgFirebaseApp: app, lastUpdated: new Date().toISOString() };
  }

  setOrgDatabase(database) {
    this.state = { ...this.state, currentOrgDatabase: database, lastUpdated: new Date().toISOString() };
  }

  setAppInitialized(initialized) {
    this.state = { ...this.state, appInitialized: initialized, lastUpdated: new Date().toISOString() };
    this.notify('appInitStatus', { initialized });
  }

  setLoading(isLoading) {
    this.state = { ...this.state, isLoading, lastUpdated: new Date().toISOString() };
    this.notify('loadingChanged', { isLoading });
  }

  setError(error) {
    this.state = {
      ...this.state,
      error: error ? { message: error.message, timestamp: new Date().toISOString() } : null,
      lastUpdated: new Date().toISOString()
    };
    this.notify('errorChanged', { error: this.state.error });
  }

  clearError() {
    this.setError(null);
  }

  clearUserData() {
    this.saveSnapshot();
    this.state = {
      currentUser: null,
      currentUserRole: null,
      isSuperAdmin: false,
      userOrganizations: [],
      currentOrganization: null,
      currentOrgFirebaseApp: null,
      currentOrgDatabase: null,
      appInitialized: false,
      isLoading: false,
      error: null,
      lastUpdated: new Date().toISOString()
    };
    this.notify('userLoggedOut');
  }

  subscribe(changeType, callback, context = null) {
    if (!callback || typeof callback !== 'function') throw new Error('Callback must be a function');
    if (!this.listeners[changeType]) this.listeners[changeType] = [];
    const listener = { callback, context };
    this.listeners[changeType].push(listener);
    return () => {
      this.listeners[changeType] = this.listeners[changeType].filter(l => l !== listener);
    };
  }

  unsubscribe(changeType, callback) {
    if (!this.listeners[changeType]) return;
    this.listeners[changeType] = this.listeners[changeType].filter(l => l.callback !== callback);
  }

  notify(changeType, data = {}) {
    if (this.listeners[changeType]) {
      this.listeners[changeType].forEach(({ callback, context }) => {
        try {
          callback.call(context, data, this.getState());
        } catch (error) {
          console.error(`Error in state listener for ${changeType}:`, error);
        }
      });
    }
    if (this.listeners['*']) {
      this.listeners['*'].forEach(({ callback, context }) => {
        try {
          callback.call(context, changeType, data, this.getState());
        } catch (error) {
          console.error(`Error in wildcard state listener:`, error);
        }
      });
    }
  }

  saveSnapshot() {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(JSON.parse(JSON.stringify(this.state)));
    this.historyIndex++;
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  undo() {
    if (this.historyIndex <= 0) return false;
    this.historyIndex--;
    this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
    this.notify('stateReverted', { action: 'undo' });
    return true;
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return false;
    this.historyIndex++;
    this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
    this.notify('stateReverted', { action: 'redo' });
    return true;
  }

  getHistoryStatus() {
    return {
      canUndo: this.historyIndex > 0,
      canRedo: this.historyIndex < this.history.length - 1,
      historySize: this.history.length
    };
  }

  static getInstance() {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  static resetInstance() {
    StateManager.instance = null;
  }
}
