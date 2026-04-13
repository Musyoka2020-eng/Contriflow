import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockOrg } from './setup.js';
import SuperAdminService from '../js/services/super-admin-service.js';

describe('SuperAdminService', () => {
  let service;
  let mockFirebaseService;

  beforeEach(() => {
    mockFirebaseService = {
      centralGet: vi.fn(),
      centralGetAll: vi.fn(),
      centralSet: vi.fn(),
      centralUpdate: vi.fn(),
      centralDelete: vi.fn()
    };
    service = new SuperAdminService(mockFirebaseService);
  });

  describe('generateSlug', () => {
    it('should convert name to lowercase hyphenated slug', () => {
      expect(service.generateSlug('Church of Grace')).toBe('church-of-grace');
    });

    it('should strip special characters', () => {
      expect(service.generateSlug('My Org & Co!')).toBe('my-org-co');
    });

    it('should collapse multiple hyphens', () => {
      expect(service.generateSlug('Hello---World')).toBe('hello-world');
    });

    it('should truncate to 50 characters', () => {
      const long = 'a'.repeat(60);
      expect(service.generateSlug(long).length).toBeLessThanOrEqual(50);
    });

    it('should trim leading/trailing whitespace', () => {
      expect(service.generateSlug('  test org  ')).toBe('test-org');
    });
  });

  describe('generateId', () => {
    it('should return a string starting with org_', () => {
      expect(service.generateId()).toMatch(/^org_/);
    });

    it('should generate unique IDs on each call', () => {
      const id1 = service.generateId();
      const id2 = service.generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('getAllOrganizations', () => {
    it('should return all organizations from Firestore', async () => {
      const mockOrgs = [createMockOrg(), createMockOrg({ slug: 'org2', name: 'Org 2' })];
      mockFirebaseService.centralGetAll.mockResolvedValue(mockOrgs);

      const result = await service.getAllOrganizations();
      expect(result).toHaveLength(2);
      expect(mockFirebaseService.centralGetAll).toHaveBeenCalledWith('organizations');
    });

    it('should return empty array when no organizations exist', async () => {
      mockFirebaseService.centralGetAll.mockResolvedValue([]);
      const result = await service.getAllOrganizations();
      expect(result).toHaveLength(0);
    });

    it('should propagate errors from firebaseService', async () => {
      mockFirebaseService.centralGetAll.mockRejectedValue(new Error('DB error'));
      await expect(service.getAllOrganizations()).rejects.toThrow('DB error');
    });
  });

  describe('updateOrgStatus', () => {
    it('should call centralDelete when status is deleted', async () => {
      mockFirebaseService.centralDelete.mockResolvedValue({ deleted: true });

      await service.updateOrgStatus('test-org', 'deleted');
      expect(mockFirebaseService.centralDelete).toHaveBeenCalledWith('organizations', 'test-org');
      expect(mockFirebaseService.centralUpdate).not.toHaveBeenCalled();
    });

    it('should call centralUpdate for non-deleted statuses', async () => {
      mockFirebaseService.centralUpdate.mockResolvedValue({});

      await service.updateOrgStatus('test-org', 'inactive');
      expect(mockFirebaseService.centralUpdate).toHaveBeenCalledWith(
        'organizations',
        'test-org',
        expect.objectContaining({ status: 'inactive' })
      );
    });

    it('should include updatedAt timestamp in update', async () => {
      mockFirebaseService.centralUpdate.mockResolvedValue({});
      await service.updateOrgStatus('test-org', 'active');
      const updateArg = mockFirebaseService.centralUpdate.mock.calls[0][2];
      expect(updateArg).toHaveProperty('updatedAt');
    });

    it('should throw if slug is empty', async () => {
      await expect(service.updateOrgStatus('', 'active')).rejects.toThrow();
    });
  });

  describe('updateOrganization', () => {
    it('should update org fields in Firestore', async () => {
      mockFirebaseService.centralUpdate.mockResolvedValue({});

      await service.updateOrganization('my-org', { name: 'New Name' });
      expect(mockFirebaseService.centralUpdate).toHaveBeenCalledWith(
        'organizations',
        'my-org',
        expect.objectContaining({ name: 'New Name', updatedAt: expect.any(String) })
      );
    });

    it('should return slug and updates on success', async () => {
      mockFirebaseService.centralUpdate.mockResolvedValue({});
      const result = await service.updateOrganization('my-org', { name: 'Updated' });
      expect(result.slug).toBe('my-org');
      expect(result.name).toBe('Updated');
    });

    it('should throw if slug is empty', async () => {
      await expect(service.updateOrganization('', { name: 'Test' })).rejects.toThrow();
    });
  });
});
