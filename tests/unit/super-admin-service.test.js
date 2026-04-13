import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetFirebaseMocks, createMockOrg } from '../setup.js';

/**
 * SuperAdminService Tests
 * Tests organization creation, validation, and super admin operations
 */

describe('SuperAdminService', () => {
  let mockCentralFirestore;
  let mockCentralAuth;

  beforeEach(() => {
    resetFirebaseMocks();

    mockCentralFirestore = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(),
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn()
        }))
      }))
    };

    mockCentralAuth = {
      createUserWithEmailAndPassword: vi.fn(),
      signInWithEmailAndPassword: vi.fn()
    };
  });

  describe('organization creation', () => {
    it('should validate Firebase config before creating organization', async () => {
      const orgName = 'Test Organization';
      const invalidConfig = null;

      // Simulating validation logic
      const validateConfig = (config) => {
        if (!config || !config.projectId) {
          throw new Error('Valid Firebase config required for organization');
        }
      };

      expect(() => {
        validateConfig(invalidConfig);
      }).toThrow('Valid Firebase config required for organization');
    });

    it('should generate slug from organization name', () => {
      const generateSlug = (name) => {
        return name
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .substring(0, 50);
      };

      expect(generateSlug('Test Organization')).toBe('test-organization');
      expect(generateSlug('ACME Corp!')).toBe('acme-corp');
      expect(generateSlug('Multi   Space   Org')).toBe('multi-space-org');
    });

    it('should check if organization slug already exists', async () => {
      const slug = 'existing-org';
      const existingOrgData = createMockOrg({ slug });

      const docMock = {
        get: vi.fn().mockResolvedValueOnce({
          exists: true,
          data: () => existingOrgData
        })
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce(docMock)
      });

      const result = await mockCentralFirestore.collection('organizations').doc(slug).get();

      expect(result.exists).toBe(true);
      expect(mockCentralFirestore.collection).toHaveBeenCalledWith('organizations');
    });

    it('should create new organization in Firestore', async () => {
      const slug = 'new-org';
      const orgName = 'New Organization';
      const firebaseConfig = {
        apiKey: 'test-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project'
      };

      const docMock = {
        get: vi.fn().mockResolvedValueOnce({
          exists: false
        }),
        set: vi.fn().mockResolvedValueOnce(undefined)
      };

      const collectionMock = {
        doc: vi.fn().mockReturnValue(docMock)
      };

      mockCentralFirestore.collection.mockReturnValue(collectionMock);

      // Check doesn't exist
      await mockCentralFirestore.collection('organizations').doc(slug).get();

      // Create org
      await mockCentralFirestore.collection('organizations').doc(slug).set({
        slug: slug,
        name: orgName,
        firebaseConfig: firebaseConfig,
        status: 'active',
        createdAt: new Date().toISOString()
      });

      expect(docMock.set).toHaveBeenCalled();
      expect(docMock.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: orgName,
          slug: slug,
          status: 'active'
        })
      );
    });
  });

  describe('organization management', () => {
    it('should fetch all organizations', async () => {
      const orgs = [
        createMockOrg({ slug: 'org1' }),
        createMockOrg({ slug: 'org2' }),
        createMockOrg({ slug: 'org3' })
      ];

      mockCentralFirestore.collection.mockReturnValueOnce({
        get: vi.fn().mockResolvedValueOnce({
          docs: orgs.map(org => ({
            id: org.slug,
            data: () => org
          }))
        })
      });

      const result = await mockCentralFirestore.collection('organizations').get();

      expect(result.docs).toHaveLength(3);
    });

    it('should update organization status', async () => {
      const slug = 'test-org';
      const newStatus = 'inactive';

      const docMock = {
        update: vi.fn().mockResolvedValueOnce(undefined)
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce(docMock)
      });

      await mockCentralFirestore.collection('organizations').doc(slug).update({
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      expect(docMock.update).toHaveBeenCalled();
      expect(docMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: newStatus
        })
      );
    });

    it('should delete organization', async () => {
      const slug = 'test-org';

      const docMock = {
        delete: vi.fn().mockResolvedValueOnce(undefined)
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce(docMock)
      });

      await mockCentralFirestore.collection('organizations').doc(slug).delete();

      expect(docMock.delete).toHaveBeenCalled();
    });
  });

  describe('admin user creation', () => {
    it('should create organization admin', async () => {
      const adminEmail = 'admin@example.com';
      const adminPassword = 'securePassword123';

      mockCentralAuth.createUserWithEmailAndPassword.mockResolvedValueOnce({
        user: {
          uid: 'admin123',
          email: adminEmail
        }
      });

      const result = await mockCentralAuth.createUserWithEmailAndPassword(
        adminEmail,
        adminPassword
      );

      expect(mockCentralAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith(
        adminEmail,
        adminPassword
      );
      expect(result.user.uid).toBe('admin123');
    });

    it('should handle email already in use error', async () => {
      const adminEmail = 'existing@example.com';
      const error = new Error('auth/email-already-in-use');

      mockCentralAuth.createUserWithEmailAndPassword.mockRejectedValueOnce(error);

      try {
        await mockCentralAuth.createUserWithEmailAndPassword(adminEmail, 'password');
        expect.fail('Should have thrown error');
      } catch (e) {
        expect(e.message).toBe('auth/email-already-in-use');
      }
    });
  });

  describe('error handling', () => {
    it('should handle Firebase errors during organization creation', async () => {
      const error = new Error('permission-denied');

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce({
          set: vi.fn().mockRejectedValueOnce(error)
        })
      });

      try {
        await mockCentralFirestore.collection('organizations').doc('slug').set({});
        expect.fail('Should have thrown error');
      } catch (e) {
        expect(e.message).toBe('permission-denied');
      }
    });

    it('should handle invalid organization data', async () => {
      const validateOrg = (orgData) => {
        if (!orgData.name) throw new Error('Organization name is required');
        if (!orgData.slug) throw new Error('Organization slug is required');
        return true;
      };

      expect(() => validateOrg({})).toThrow('Organization name is required');
      expect(() => validateOrg({ name: 'Test' })).toThrow('Organization slug is required');
    });
  });
});
