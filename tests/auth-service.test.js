import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockUser } from './setup.js';
import AuthService from '../js/services/auth-service.js';

describe('AuthService', () => {
  let service;
  let mockFirebaseService;
  let mockOrgManager;
  let mockStateManager;

  beforeEach(() => {
    mockFirebaseService = {
      signInWithEmailAndPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChanged: vi.fn(),
      centralGet: vi.fn(),
      centralSet: vi.fn()
    };
    mockOrgManager = {
      loadUserOrganizations: vi.fn().mockResolvedValue([]),
      clearCurrentOrg: vi.fn(),
      userOrganizations: []
    };
    mockStateManager = {
      setCurrentUser: vi.fn(),
      setUserRole: vi.fn(),
      setUserOrganizations: vi.fn(),
      clearUserData: vi.fn(),
      setError: vi.fn()
    };
    service = new AuthService(mockFirebaseService, mockOrgManager, mockStateManager);
  });

  describe('signIn', () => {
    it('should delegate to firebaseService.signInWithEmailAndPassword', async () => {
      const mockUser = createMockUser();
      mockFirebaseService.signInWithEmailAndPassword.mockResolvedValue(mockUser);

      const result = await service.signIn('test@example.com', 'password123');
      expect(mockFirebaseService.signInWithEmailAndPassword).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
      expect(result).toBe(mockUser);
    });

    it('should propagate sign-in errors', async () => {
      mockFirebaseService.signInWithEmailAndPassword.mockRejectedValue(
        new Error('auth/wrong-password')
      );
      await expect(service.signIn('user@test.com', 'wrong')).rejects.toThrow('auth/wrong-password');
    });
  });

  describe('signOut', () => {
    it('should delegate to firebaseService.signOut', async () => {
      mockFirebaseService.signOut.mockResolvedValue();
      await service.signOut();
      expect(mockFirebaseService.signOut).toHaveBeenCalled();
    });

    it('should propagate sign-out errors', async () => {
      mockFirebaseService.signOut.mockRejectedValue(new Error('sign out failed'));
      await expect(service.signOut()).rejects.toThrow('sign out failed');
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when currentUser is null', () => {
      service.currentUser = null;
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return true when currentUser is set', () => {
      service.currentUser = createMockUser();
      expect(service.isAuthenticated()).toBe(true);
    });
  });

  describe('isSuperAdmin', () => {
    it('should return true when role is superadmin', () => {
      service.currentUserRole = 'superadmin';
      expect(service.isSuperAdmin()).toBe(true);
    });

    it('should return false for non-superadmin roles', () => {
      service.currentUserRole = 'user';
      expect(service.isSuperAdmin()).toBe(false);
    });

    it('should return false when role is null', () => {
      service.currentUserRole = null;
      expect(service.isSuperAdmin()).toBe(false);
    });
  });

  describe('canAccessOrg', () => {
    it('should return true for superadmin regardless of org', () => {
      service.currentUserRole = 'superadmin';
      expect(service.canAccessOrg('any-org')).toBe(true);
    });

    it('should return true when org slug matches user organizations', () => {
      service.currentUserRole = 'user';
      service.userOrganizations = [{ slug: 'my-org', name: 'My Org' }];
      expect(service.canAccessOrg('my-org')).toBe(true);
    });

    it('should return false when org not in user organizations', () => {
      service.currentUserRole = 'user';
      service.userOrganizations = [{ slug: 'other-org', name: 'Other Org' }];
      expect(service.canAccessOrg('my-org')).toBe(false);
    });

    it('should return false when user has no organizations', () => {
      service.currentUserRole = 'user';
      service.userOrganizations = [];
      expect(service.canAccessOrg('any-org')).toBe(false);
    });
  });

  describe('handleUserSignOut', () => {
    it('should clear user data', async () => {
      service.currentUser = createMockUser();
      service.currentUserRole = 'user';
      service.userOrganizations = [{ slug: 'org1' }];

      await service.handleUserSignOut();

      expect(service.currentUser).toBeNull();
      expect(service.currentUserRole).toBeNull();
      expect(service.userOrganizations).toHaveLength(0);
    });

    it('should call stateManager.clearUserData when available', async () => {
      await service.handleUserSignOut();
      expect(mockStateManager.clearUserData).toHaveBeenCalled();
    });

    it('should call orgManager.clearCurrentOrg', async () => {
      await service.handleUserSignOut();
      expect(mockOrgManager.clearCurrentOrg).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser / getCurrentUserRole', () => {
    it('should return currentUser', () => {
      const user = createMockUser();
      service.currentUser = user;
      expect(service.getCurrentUser()).toBe(user);
    });

    it('should return currentUserRole', () => {
      service.currentUserRole = 'admin';
      expect(service.getCurrentUserRole()).toBe('admin');
    });
  });
});
