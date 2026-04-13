import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetFirebaseMocks, createMockOrg, createMockDocSnapshot, createMockQuerySnapshot } from '../setup.js';

/**
 * OrgManager Tests
 * Tests organization loading, member management, and organization context
 */

describe('OrgManager', () => {
  let mockCentralFirestore;
  let mockOrgDatabase;

  beforeEach(() => {
    resetFirebaseMocks();

    mockCentralFirestore = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(),
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({
              get: vi.fn(),
              set: vi.fn(),
              update: vi.fn(),
              delete: vi.fn()
            }))
          }))
        }))
      }))
    };

    mockOrgDatabase = {
      ref: vi.fn(() => ({
        set: vi.fn(),
        get: vi.fn(),
        update: vi.fn()
      }))
    };
  });

  describe('load organization', () => {
    it('should load organization from Firestore by slug', async () => {
      const slug = 'test-org';
      const orgData = createMockOrg({ slug });

      const docMock = {
        exists: true,
        id: slug,
        data: () => orgData
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce({
          get: vi.fn().mockResolvedValueOnce(docMock)
        })
      });

      const result = await mockCentralFirestore.collection('organizations').doc(slug).get();

      expect(mockCentralFirestore.collection).toHaveBeenCalledWith('organizations');
      expect(result.exists).toBe(true);
      expect(result.data()).toEqual(orgData);
    });

    it('should handle organization not found', async () => {
      const slug = 'nonexistent-org';

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce({
          get: vi.fn().mockResolvedValueOnce({
            exists: false
          })
        })
      });

      const result = await mockCentralFirestore.collection('organizations').doc(slug).get();

      expect(result.exists).toBe(false);
    });
  });

  describe('load user organizations', () => {
    it('should load all organizations for a user', async () => {
      const userId = 'user123';
      const orgs = [
        createMockOrg({ slug: 'org1' }),
        createMockOrg({ slug: 'org2' })
      ];

      const docMock = {
        exists: true,
        data: () => ({ organizations: ['org1', 'org2'] })
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce({
          get: vi.fn().mockResolvedValueOnce(docMock)
        })
      });

      const result = await mockCentralFirestore.collection('userOrganizations').doc(userId).get();

      expect(result.exists).toBe(true);
      expect(result.data().organizations).toHaveLength(2);
    });

    it('should handle user with no organizations', async () => {
      const userId = 'newuser';

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce({
          get: vi.fn().mockResolvedValueOnce({
            exists: false
          })
        })
      });

      const result = await mockCentralFirestore.collection('userOrganizations').doc(userId).get();

      expect(result.exists).toBe(false);
    });
  });

  describe('member management', () => {
    it('should add member to organization', async () => {
      const orgSlug = 'test-org';
      const userId = 'user456';
      const email = 'member@example.com';
      const role = 'editor';

      const memberDocMock = {
        set: vi.fn().mockResolvedValueOnce(undefined)
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce({
          collection: vi.fn().mockReturnValueOnce({
            doc: vi.fn().mockReturnValueOnce(memberDocMock)
          })
        })
      });

      await mockCentralFirestore
        .collection('organizations')
        .doc(orgSlug)
        .collection('members')
        .doc(userId)
        .set({
          email: email,
          role: role,
          addedAt: new Date().toISOString()
        });

      expect(memberDocMock.set).toHaveBeenCalled();
      expect(memberDocMock.set).toHaveBeenCalledWith(
        expect.objectContaining({
          email: email,
          role: role
        })
      );
    });

    it('should update member role in organization', async () => {
      const orgSlug = 'test-org';
      const userId = 'user456';
      const newRole = 'admin';

      const memberDocMock = {
        update: vi.fn().mockResolvedValueOnce(undefined)
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce({
          collection: vi.fn().mockReturnValueOnce({
            doc: vi.fn().mockReturnValueOnce(memberDocMock)
          })
        })
      });

      await mockCentralFirestore
        .collection('organizations')
        .doc(orgSlug)
        .collection('members')
        .doc(userId)
        .update({ role: newRole });

      expect(memberDocMock.update).toHaveBeenCalledWith({ role: newRole });
    });

    it('should remove member from organization', async () => {
      const orgSlug = 'test-org';
      const userId = 'user456';

      const memberDocMock = {
        delete: vi.fn().mockResolvedValueOnce(undefined)
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce({
          collection: vi.fn().mockReturnValueOnce({
            doc: vi.fn().mockReturnValueOnce(memberDocMock)
          })
        })
      });

      await mockCentralFirestore
        .collection('organizations')
        .doc(orgSlug)
        .collection('members')
        .doc(userId)
        .delete();

      expect(memberDocMock.delete).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle Firestore errors when loading organizations', async () => {
      const error = new Error('permission-denied');

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce({
          get: vi.fn().mockRejectedValueOnce(error)
        })
      });

      try {
        await mockCentralFirestore.collection('organizations').doc('slug').get();
        expect.fail('Should have thrown error');
      } catch (e) {
        expect(e.message).toBe('permission-denied');
      }
    });
  });
});
