import { describe, it, expect, beforeEach, vi } from 'vitest';
import StateManager from '../js/core/state-manager.js';

describe('StateManager', () => {
  let manager;

  beforeEach(() => {
    StateManager.resetInstance();
    manager = StateManager.getInstance();
  });

  describe('getState', () => {
    it('should return a frozen state object', () => {
      const state = manager.getState();
      expect(Object.isFrozen(state)).toBe(true);
    });

    it('should have correct initial values', () => {
      const state = manager.getState();
      expect(state.currentUser).toBe(null);
      expect(state.currentUserRole).toBe(null);
      expect(state.isSuperAdmin).toBe(false);
      expect(state.userOrganizations).toEqual([]);
      expect(state.appInitialized).toBe(false);
    });
  });

  describe('setCurrentUser', () => {
    it('should set the current user in state', () => {
      manager.setCurrentUser({ uid: 'u1', email: 'a@b.com' });
      expect(manager.getState().currentUser.uid).toBe('u1');
      expect(manager.getState().currentUser.email).toBe('a@b.com');
    });

    it('should set optional display name', () => {
      manager.setCurrentUser({ uid: 'u1', email: 'a@b.com', displayName: 'Alice' });
      expect(manager.getState().currentUser.displayName).toBe('Alice');
    });

    it('should throw if user is null', () => {
      expect(() => manager.setCurrentUser(null)).toThrow();
    });

    it('should throw if uid is missing', () => {
      expect(() => manager.setCurrentUser({ email: 'a@b.com' })).toThrow();
    });

    it('should throw if email is missing', () => {
      expect(() => manager.setCurrentUser({ uid: 'u1' })).toThrow();
    });
  });

  describe('setUserRole', () => {
    it('should set role in state', () => {
      manager.setUserRole('admin');
      expect(manager.getState().currentUserRole).toBe('admin');
    });

    it('should set isSuperAdmin to true for superadmin role', () => {
      manager.setUserRole('superadmin');
      expect(manager.getState().isSuperAdmin).toBe(true);
    });

    it('should set isSuperAdmin to false for non-superadmin roles', () => {
      manager.setUserRole('superadmin');
      manager.setUserRole('admin');
      expect(manager.getState().isSuperAdmin).toBe(false);
    });

    it('should throw if role is falsy', () => {
      expect(() => manager.setUserRole('')).toThrow();
      expect(() => manager.setUserRole(null)).toThrow();
    });
  });

  describe('setUserOrganizations', () => {
    it('should set organizations array', () => {
      const orgs = [{ slug: 'org1', name: 'Org 1' }];
      manager.setUserOrganizations(orgs);
      expect(manager.getState().userOrganizations).toHaveLength(1);
    });

    it('should throw if argument is not an array', () => {
      expect(() => manager.setUserOrganizations(null)).toThrow();
      expect(() => manager.setUserOrganizations('not-array')).toThrow();
    });
  });

  describe('setCurrentOrganization', () => {
    it('should set current org in state', () => {
      manager.setCurrentOrganization({ slug: 'test-org', name: 'Test' });
      expect(manager.getState().currentOrganization.slug).toBe('test-org');
    });

    it('should throw if org is null', () => {
      expect(() => manager.setCurrentOrganization(null)).toThrow();
    });

    it('should throw if org has no slug', () => {
      expect(() => manager.setCurrentOrganization({ name: 'No slug' })).toThrow();
    });
  });

  describe('addUserOrganization', () => {
    it('should append an organization to the list', () => {
      manager.setUserOrganizations([]);
      manager.addUserOrganization({ slug: 'new-org', name: 'New' });
      expect(manager.getState().userOrganizations).toHaveLength(1);
    });

    it('should not add duplicate org', () => {
      manager.setUserOrganizations([{ slug: 'org1' }]);
      manager.addUserOrganization({ slug: 'org1' });
      expect(manager.getState().userOrganizations).toHaveLength(1);
    });

    it('should throw if org has no slug', () => {
      expect(() => manager.addUserOrganization({ name: 'no slug' })).toThrow();
    });
  });

  describe('removeUserOrganization', () => {
    it('should remove an org by slug', () => {
      manager.setUserOrganizations([{ slug: 'org1' }, { slug: 'org2' }]);
      manager.removeUserOrganization('org1');
      expect(manager.getState().userOrganizations).toHaveLength(1);
      expect(manager.getState().userOrganizations[0].slug).toBe('org2');
    });

    it('should do nothing if slug not found', () => {
      manager.setUserOrganizations([{ slug: 'org1' }]);
      manager.removeUserOrganization('not-there');
      expect(manager.getState().userOrganizations).toHaveLength(1);
    });
  });

  describe('clearCurrentOrganization', () => {
    it('should clear the current organization', () => {
      manager.setCurrentOrganization({ slug: 'org1' });
      manager.clearCurrentOrganization();
      expect(manager.getState().currentOrganization).toBe(null);
    });
  });

  describe('setError / clearError', () => {
    it('should set error in state', () => {
      manager.setError('Something went wrong');
      expect(manager.getState().error).not.toBe(null);
    });

    it('should clear error after clearError', () => {
      manager.setError('err');
      manager.clearError();
      expect(manager.getState().error).toBe(null);
    });
  });

  describe('subscribe / notify', () => {
    it('should call listener when matching event fires', () => {
      const callback = vi.fn();
      manager.subscribe('userChanged', callback);
      manager.setCurrentUser({ uid: 'u1', email: 'a@b.com' });
      expect(callback).toHaveBeenCalled();
    });

    it('should stop calling listener after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = manager.subscribe('userChanged', callback);
      unsubscribe();
      manager.setCurrentUser({ uid: 'u2', email: 'b@c.com' });
      expect(callback).not.toHaveBeenCalled();
    });

    it('wildcard listener should receive all events', () => {
      const callback = vi.fn();
      manager.subscribe('*', callback);
      manager.setUserRole('admin');
      manager.setUserOrganizations([]);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should throw if callback is not a function', () => {
      expect(() => manager.subscribe('userChanged', 'not-a-fn')).toThrow();
    });
  });

  describe('undo / redo', () => {
    it('should undo the last state change', () => {
      manager.setUserRole('admin');
      manager.setUserRole('superadmin');
      manager.undo();
      expect(manager.getState().currentUserRole).toBe('admin');
    });

    it('should redo after undo', () => {
      manager.setUserRole('admin');
      manager.setUserRole('superadmin');
      manager.undo();
      manager.redo();
      expect(manager.getState().currentUserRole).toBe('superadmin');
    });

    it('should return false if nothing to undo', () => {
      expect(manager.undo()).toBe(false);
    });

    it('should return false if nothing to redo', () => {
      manager.setUserRole('admin');
      expect(manager.redo()).toBe(false);
    });
  });

  describe('clearUserData', () => {
    it('should reset all user-related state to initial values', () => {
      manager.setCurrentUser({ uid: 'u1', email: 'a@b.com' });
      manager.setUserRole('admin');
      manager.setUserOrganizations([{ slug: 'org1' }]);
      manager.clearUserData();

      const state = manager.getState();
      expect(state.currentUser).toBe(null);
      expect(state.currentUserRole).toBe(null);
      expect(state.isSuperAdmin).toBe(false);
      expect(state.userOrganizations).toEqual([]);
    });
  });

  describe('getValue', () => {
    it('should get a top-level state value', () => {
      manager.setUserRole('editor');
      expect(manager.getValue('currentUserRole')).toBe('editor');
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = StateManager.getInstance();
      const b = StateManager.getInstance();
      expect(a).toBe(b);
    });

    it('should create new instance after reset', () => {
      const a = StateManager.getInstance();
      StateManager.resetInstance();
      const b = StateManager.getInstance();
      expect(a).not.toBe(b);
    });
  });
});
