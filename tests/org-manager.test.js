import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockOrg } from './setup.js';
import OrgManager from '../js/services/org-manager.js';

describe('OrgManager', () => {
  let manager;
  let mockFirebaseService;
  let mockStateManager;

  beforeEach(() => {
    mockFirebaseService = {
      centralGet: vi.fn(),
      centralSet: vi.fn(),
      centralUpdate: vi.fn(),
      centralDelete: vi.fn(),
      centralCreateNested: vi.fn(),
      centralUpdateNested: vi.fn(),
      centralDeleteNested: vi.fn()
    };
    mockStateManager = {
      setCurrentOrganization: vi.fn(),
      setUserOrganizations: vi.fn(),
      setError: vi.fn(),
      clearUserData: vi.fn()
    };
    manager = new OrgManager(mockFirebaseService, mockStateManager);
  });

  afterEach(() => {
    OrgManager.instance = null;
  });

  describe('getOrgSlug', () => {
    it('should return null when no org is loaded', () => {
      expect(manager.getOrgSlug()).toBeNull();
    });

    it('should return slug when org is loaded', () => {
      manager.currentOrg = createMockOrg({ slug: 'test-church' });
      expect(manager.getOrgSlug()).toBe('test-church');
    });
  });

  describe('getCurrentOrg', () => {
    it('should return null by default', () => {
      expect(manager.getCurrentOrg()).toBeNull();
    });

    it('should return org after being set', () => {
      const org = createMockOrg();
      manager.currentOrg = org;
      expect(manager.getCurrentOrg()).toBe(org);
    });
  });

  describe('clearCurrentOrg', () => {
    it('should null out currentOrg, orgDatabase, and orgFirebaseApp', () => {
      manager.currentOrg = createMockOrg();
      manager.orgDatabase = { ref: vi.fn() };
      manager.orgFirebaseApp = { delete: vi.fn() };

      manager.clearCurrentOrg();

      expect(manager.currentOrg).toBeNull();
      expect(manager.orgDatabase).toBeNull();
      expect(manager.orgFirebaseApp).toBeNull();
    });
  });

  describe('addMember', () => {
    beforeEach(() => {
      manager.currentOrg = createMockOrg({ slug: 'my-org' });
    });

    it('should throw if no organization is loaded', async () => {
      manager.currentOrg = null;
      await expect(manager.addMember('uid123', 'user@test.com')).rejects.toThrow(
        'No organization loaded'
      );
    });

    it('should call centralCreateNested to add member record', async () => {
      mockFirebaseService.centralCreateNested.mockResolvedValue({});
      mockFirebaseService.centralGet.mockResolvedValue(
        { exists: true, data: { organizations: [] }, id: 'uid123' }
      );
      mockFirebaseService.centralSet.mockResolvedValue({});

      await manager.addMember('uid123', 'user@test.com', 'editor');

      expect(mockFirebaseService.centralCreateNested).toHaveBeenCalledWith(
        'organizations',
        'my-org',
        'members',
        'uid123',
        expect.objectContaining({ email: 'user@test.com', role: 'editor' })
      );
    });

    it('should update userOrganizations if user already has orgs', async () => {
      mockFirebaseService.centralCreateNested.mockResolvedValue({});
      mockFirebaseService.centralGet.mockResolvedValue(
        { exists: true, data: { organizations: ['existing-org'] }, id: 'uid123' }
      );
      mockFirebaseService.centralUpdate.mockResolvedValue({});

      await manager.addMember('uid123', 'user@test.com');

      expect(mockFirebaseService.centralUpdate).toHaveBeenCalledWith(
        'userOrganizations',
        'uid123',
        expect.objectContaining({ organizations: expect.arrayContaining(['my-org', 'existing-org']) })
      );
    });

    it('should create userOrganizations doc if user has no orgs', async () => {
      mockFirebaseService.centralCreateNested.mockResolvedValue({});
      mockFirebaseService.centralGet.mockResolvedValue({ exists: false, data: null, id: 'uid123' });
      mockFirebaseService.centralSet.mockResolvedValue({});

      await manager.addMember('uid123', 'newuser@test.com');

      expect(mockFirebaseService.centralSet).toHaveBeenCalledWith(
        'userOrganizations',
        'uid123',
        expect.objectContaining({ organizations: ['my-org'] })
      );
    });

    it('should not duplicate org in user organizations list', async () => {
      mockFirebaseService.centralCreateNested.mockResolvedValue({});
      mockFirebaseService.centralGet.mockResolvedValue(
        { exists: true, data: { organizations: ['my-org'] }, id: 'uid123' }
      );
      mockFirebaseService.centralUpdate.mockResolvedValue({});

      await manager.addMember('uid123', 'user@test.com');

      // centralUpdate should not be called since org already in list
      expect(mockFirebaseService.centralUpdate).not.toHaveBeenCalled();
    });

    it('should return true on success', async () => {
      mockFirebaseService.centralCreateNested.mockResolvedValue({});
      mockFirebaseService.centralGet.mockResolvedValue({ exists: false, data: null, id: 'uid123' });
      mockFirebaseService.centralSet.mockResolvedValue({});

      const result = await manager.addMember('uid123', 'user@test.com');
      expect(result).toBe(true);
    });
  });

  describe('loadUserOrganizations', () => {
    it('should return empty array if user has no org document', async () => {
      mockFirebaseService.centralGet.mockResolvedValue({ exists: false, data: null, id: 'uid' });

      const result = await manager.loadUserOrganizations('uid123');
      expect(result).toHaveLength(0);
    });

    it('should load orgs by slug from user organization list', async () => {
      mockFirebaseService.centralGet
        .mockResolvedValueOnce({ exists: true, data: { organizations: ['org1'] }, id: 'uid123' })
        .mockResolvedValueOnce({ exists: true, data: { name: 'Org One' }, id: 'org1' });

      const result = await manager.loadUserOrganizations('uid123');
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('org1');
    });

    it('should update stateManager with loaded organizations', async () => {
      mockFirebaseService.centralGet.mockResolvedValue({ exists: false, data: null, id: 'uid' });

      await manager.loadUserOrganizations('uid123');
      expect(mockStateManager.setUserOrganizations).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should return true', async () => {
      const result = await manager.initialize();
      expect(result).toBe(true);
    });
  });
});
