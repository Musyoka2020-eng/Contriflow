import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockDocSnapshot, createMockQuerySnapshot } from './setup.js';
import FirebaseService from '../js/services/firebase-service.js';

describe('FirebaseService', () => {
  let service;
  let mockFirestore;
  let mockAuth;

  beforeEach(() => {
    FirebaseService.resetInstance();
    service = FirebaseService.getInstance();

    mockAuth = {
      createUserWithEmailAndPassword: vi.fn(),
      signInWithEmailAndPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChanged: vi.fn((cb) => { cb(null); return () => {}; })
    };

    mockFirestore = {
      collection: vi.fn()
    };
  });

  describe('initializeCentral', () => {
    it('should initialize with auth and firestore', async () => {
      await service.initializeCentral(mockAuth, mockFirestore);
      expect(service.centralAuth).toBe(mockAuth);
      expect(service.centralFirestore).toBe(mockFirestore);
    });

    it('should accept null auth (auth is optional)', async () => {
      await service.initializeCentral(null, mockFirestore);
      expect(service.centralAuth).toBe(null);
      expect(service.centralFirestore).toBe(mockFirestore);
    });

    it('should throw if firestore is not provided', async () => {
      await expect(service.initializeCentral(null, null)).rejects.toThrow();
    });
  });

  describe('centralGet', () => {
    beforeEach(async () => {
      await service.initializeCentral(mockAuth, mockFirestore);
    });

    it('should return document data when it exists', async () => {
      const mockDoc = createMockDocSnapshot({ name: 'Test Org' });
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(mockDoc) })
      });

      const result = await service.centralGet('organizations', 'test-slug');
      expect(result.exists).toBe(true);
      expect(result.data.name).toBe('Test Org');
    });

    it('should return exists:false when document does not exist', async () => {
      const mockDoc = createMockDocSnapshot(null, false);
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(mockDoc) })
      });

      const result = await service.centralGet('organizations', 'missing');
      expect(result.exists).toBe(false);
      expect(result.data).toBe(null);
    });

    it('should throw if collection is missing', async () => {
      await expect(service.centralGet('', 'id')).rejects.toThrow();
    });

    it('should throw if documentId is missing', async () => {
      await expect(service.centralGet('col', '')).rejects.toThrow();
    });
  });

  describe('centralGetAll', () => {
    beforeEach(async () => {
      await service.initializeCentral(mockAuth, mockFirestore);
    });

    it('should return all documents in a collection', async () => {
      const mockDocs = [
        { id: 'org1', data: () => ({ name: 'Org 1' }) },
        { id: 'org2', data: () => ({ name: 'Org 2' }) }
      ];
      const mockSnapshot = createMockQuerySnapshot(mockDocs);
      mockFirestore.collection.mockReturnValue({
        get: vi.fn().mockResolvedValue(mockSnapshot),
        where: vi.fn().mockReturnThis()
      });

      const results = await service.centralGetAll('organizations');
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('org1');
      expect(results[0].name).toBe('Org 1');
    });

    it('should return empty array when collection is empty', async () => {
      const mockSnapshot = createMockQuerySnapshot([]);
      mockFirestore.collection.mockReturnValue({
        get: vi.fn().mockResolvedValue(mockSnapshot),
        where: vi.fn().mockReturnThis()
      });

      const results = await service.centralGetAll('organizations');
      expect(results).toHaveLength(0);
    });

    it('should throw if collection name is missing', async () => {
      await expect(service.centralGetAll('')).rejects.toThrow();
    });
  });

  describe('centralSet', () => {
    beforeEach(async () => {
      await service.initializeCentral(mockAuth, mockFirestore);
    });

    it('should set a document and return data with id', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined);
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({ set: mockSet })
      });

      const data = { name: 'Test' };
      const result = await service.centralSet('orgs', 'slug1', data);
      expect(mockSet).toHaveBeenCalledWith(data, { merge: false });
      expect(result.id).toBe('slug1');
      expect(result.name).toBe('Test');
    });

    it('should support merge option', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined);
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({ set: mockSet })
      });

      await service.centralSet('orgs', 'slug1', { name: 'Test' }, true);
      expect(mockSet).toHaveBeenCalledWith({ name: 'Test' }, { merge: true });
    });
  });

  describe('centralUpdate', () => {
    beforeEach(async () => {
      await service.initializeCentral(mockAuth, mockFirestore);
    });

    it('should update a document and return updated fields', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({ update: mockUpdate })
      });

      const result = await service.centralUpdate('orgs', 'slug1', { status: 'inactive' });
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'inactive' });
      expect(result.status).toBe('inactive');
    });
  });

  describe('centralDelete', () => {
    beforeEach(async () => {
      await service.initializeCentral(mockAuth, mockFirestore);
    });

    it('should delete a document and return deleted flag', async () => {
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue({ delete: mockDelete })
      });

      const result = await service.centralDelete('orgs', 'slug1');
      expect(mockDelete).toHaveBeenCalled();
      expect(result.deleted).toBe(true);
    });
  });

  describe('signInWithEmailAndPassword', () => {
    beforeEach(async () => {
      await service.initializeCentral(mockAuth, mockFirestore);
    });

    it('should sign in and return user data', async () => {
      mockAuth.signInWithEmailAndPassword.mockResolvedValue({
        user: { uid: 'uid1', email: 'test@test.com', displayName: null, photoURL: null }
      });

      const result = await service.signInWithEmailAndPassword('test@test.com', 'pass123');
      expect(result.uid).toBe('uid1');
      expect(result.email).toBe('test@test.com');
    });

    it('should throw if email is missing', async () => {
      await expect(service.signInWithEmailAndPassword('', 'pass')).rejects.toThrow();
    });

    it('should throw if password is missing', async () => {
      await expect(service.signInWithEmailAndPassword('email@a.com', '')).rejects.toThrow();
    });
  });

  describe('signOut', () => {
    beforeEach(async () => {
      await service.initializeCentral(mockAuth, mockFirestore);
    });

    it('should call auth.signOut', async () => {
      mockAuth.signOut.mockResolvedValue(undefined);
      await service.signOut();
      expect(mockAuth.signOut).toHaveBeenCalled();
    });

    it('should throw if auth is not initialized', async () => {
      FirebaseService.resetInstance();
      const s = FirebaseService.getInstance();
      await s.initializeCentral(null, mockFirestore);
      await expect(s.signOut()).rejects.toThrow('Firebase Auth not initialized');
    });
  });

  describe('onAuthStateChanged', () => {
    beforeEach(async () => {
      await service.initializeCentral(mockAuth, mockFirestore);
    });

    it('should subscribe and call callback with null when no auth', () => {
      FirebaseService.resetInstance();
      const s = FirebaseService.getInstance();
      s.initializeCentral(null, mockFirestore);
      const cb = vi.fn();
      s.onAuthStateChanged(cb);
      expect(cb).toHaveBeenCalledWith(null);
    });

    it('should throw if callback is not a function', async () => {
      expect(() => service.onAuthStateChanged('not-a-function')).toThrow();
    });
  });
});
