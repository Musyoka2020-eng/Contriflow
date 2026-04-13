import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * FirebaseService Tests
 * Tests centralized database operations layer (mocked)
 * Note: FirebaseService is tested with mocked Firebase SDK
 */

describe('FirebaseService (Mocked)', () => {
  let firebaseService;
  let mockCentralAuth;
  let mockCentralFirestore;

  class MockFirebaseService {
    constructor() {
      this.centralFirestore = null;
      this.centralAuth = null;
      this.orgFirebaseInstances = {};
    }

    async initializeCentral(auth, firestore) {
      if (!auth || !firestore) throw new Error('Central Auth and Firestore instances are required');
      this.centralAuth = auth;
      this.centralFirestore = firestore;
      return true;
    }

    async createUserWithEmailAndPassword(email, password) {
      if (!email || !password) throw new Error('Email and password are required');
      try {
        const result = await this.centralAuth.createUserWithEmailAndPassword(email, password);
        return {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL
        };
      } catch (error) {
        throw this.handleAuthError(error);
      }
    }

    async signInWithEmailAndPassword(email, password) {
      if (!email || !password) throw new Error('Email and password are required');
      try {
        const result = await this.centralAuth.signInWithEmailAndPassword(email, password);
        return {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL
        };
      } catch (error) {
        throw this.handleAuthError(error);
      }
    }

    async signOut() {
      try {
        await this.centralAuth.signOut();
        return true;
      } catch (error) {
        throw this.handleAuthError(error);
      }
    }

    onAuthStateChanged(callback) {
      if (!callback || typeof callback !== 'function') {
        throw new Error('Callback must be a function');
      }
      return this.centralAuth.onAuthStateChanged((user) => {
        try {
          callback(user);
        } catch (error) {
          console.error('Error in auth state change callback:', error);
        }
      });
    }

    async centralGet(collection, documentId) {
      if (!collection || !documentId) throw new Error('Collection and document ID are required');
      try {
        const docSnapshot = await this.centralFirestore.collection(collection).doc(documentId).get();
        return {
          exists: docSnapshot.exists,
          data: docSnapshot.exists ? docSnapshot.data() : null,
          id: docSnapshot.id
        };
      } catch (error) {
        throw this.handleFirestoreError(error, 'get', collection, documentId);
      }
    }

    async centralGetAll(collection, whereConditions = []) {
      if (!collection) throw new Error('Collection is required');
      try {
        let query = this.centralFirestore.collection(collection);
        whereConditions.forEach(({ field, operator, value }) => {
          query = query.where(field, operator, value);
        });
        const snapshot = await query.get();
        const documents = [];
        snapshot.forEach((doc) => {
          documents.push({ id: doc.id, ...doc.data() });
        });
        return documents;
      } catch (error) {
        throw this.handleFirestoreError(error, 'getAll', collection);
      }
    }

    async centralSet(collection, documentId, data, merge = false) {
      if (!collection || !documentId || !data) {
        throw new Error('Collection, document ID, and data are required');
      }
      try {
        await this.centralFirestore.collection(collection).doc(documentId).set(data, { merge });
        return { id: documentId, ...data };
      } catch (error) {
        throw this.handleFirestoreError(error, 'set', collection, documentId);
      }
    }

    async centralUpdate(collection, documentId, updates) {
      if (!collection || !documentId || !updates) {
        throw new Error('Collection, document ID, and updates are required');
      }
      try {
        await this.centralFirestore.collection(collection).doc(documentId).update(updates);
        return { id: documentId, ...updates };
      } catch (error) {
        throw this.handleFirestoreError(error, 'update', collection, documentId);
      }
    }

    async centralDelete(collection, documentId) {
      if (!collection || !documentId) {
        throw new Error('Collection and document ID are required');
      }
      try {
        await this.centralFirestore.collection(collection).doc(documentId).delete();
        return { id: documentId, deleted: true };
      } catch (error) {
        throw this.handleFirestoreError(error, 'delete', collection, documentId);
      }
    }

    async centralCreateNested(collection, documentId, subcollection, nestedId, data) {
      if (!collection || !documentId || !subcollection || !nestedId || !data) {
        throw new Error('All parameters are required for nested create');
      }
      try {
        await this.centralFirestore
          .collection(collection)
          .doc(documentId)
          .collection(subcollection)
          .doc(nestedId)
          .set(data);
        return { parentId: documentId, nestedId: nestedId, ...data };
      } catch (error) {
        throw this.handleFirestoreError(error, 'createNested', collection, documentId);
      }
    }

    async centralGetNested(collection, documentId, subcollection, nestedId) {
      if (!collection || !documentId || !subcollection || !nestedId) {
        throw new Error('All parameters are required for nested get');
      }
      try {
        const docSnapshot = await this.centralFirestore
          .collection(collection)
          .doc(documentId)
          .collection(subcollection)
          .doc(nestedId)
          .get();
        return {
          exists: docSnapshot.exists,
          data: docSnapshot.exists ? docSnapshot.data() : null,
          id: docSnapshot.id
        };
      } catch (error) {
        throw this.handleFirestoreError(error, 'getNested', collection, documentId);
      }
    }

    async centralGetAllNested(collection, documentId, subcollection) {
      if (!collection || !documentId || !subcollection) {
        throw new Error('Collection, document ID, and subcollection are required');
      }
      try {
        const snapshot = await this.centralFirestore
          .collection(collection)
          .doc(documentId)
          .collection(subcollection)
          .get();
        const documents = [];
        snapshot.forEach((doc) => {
          documents.push({ id: doc.id, ...doc.data() });
        });
        return documents;
      } catch (error) {
        throw this.handleFirestoreError(error, 'getAllNested', collection, documentId);
      }
    }

    registerOrgInstance(slug, firebaseApp, database) {
      if (!slug || !firebaseApp || !database) {
        throw new Error('Slug, Firebase app, and database are required');
      }
      this.orgFirebaseInstances[slug] = { app: firebaseApp, database: database };
      return true;
    }

    getOrgInstance(slug) {
      if (!slug) throw new Error('Organization slug is required');
      const instance = this.orgFirebaseInstances[slug];
      if (!instance) throw new Error(`No Firebase instance registered for organization: ${slug}`);
      return instance;
    }

    async orgDatabaseSet(slug, path, data) {
      if (!slug || !path || !data) throw new Error('Slug, path, and data are required');
      try {
        const { database } = this.getOrgInstance(slug);
        await database.ref(path).set(data);
        return { slug, path, data };
      } catch (error) {
        throw this.handleDatabaseError(error, 'set', slug, path);
      }
    }

    async orgDatabaseGet(slug, path) {
      if (!slug || !path) throw new Error('Slug and path are required');
      try {
        const { database } = this.getOrgInstance(slug);
        const snapshot = await database.ref(path).get();
        return { exists: snapshot.exists(), data: snapshot.exists() ? snapshot.val() : null, path };
      } catch (error) {
        throw this.handleDatabaseError(error, 'get', slug, path);
      }
    }

    async orgDatabaseUpdate(slug, path, updates) {
      if (!slug || !path || !updates) throw new Error('Slug, path, and updates are required');
      try {
        const { database } = this.getOrgInstance(slug);
        await database.ref(path).update(updates);
        return { slug, path, updates };
      } catch (error) {
        throw this.handleDatabaseError(error, 'update', slug, path);
      }
    }

    async orgDatabaseDelete(slug, path) {
      if (!slug || !path) throw new Error('Slug and path are required');
      try {
        const { database } = this.getOrgInstance(slug);
        await database.ref(path).remove();
        return { slug, path, deleted: true };
      } catch (error) {
        throw this.handleDatabaseError(error, 'delete', slug, path);
      }
    }

    onOrgDatabaseChange(slug, path, callback) {
      if (!slug || !path || !callback) {
        throw new Error('Slug, path, and callback are required');
      }
      try {
        const { database } = this.getOrgInstance(slug);
        const ref = database.ref(path);
        ref.on('value', (snapshot) => {
          try {
            callback({ exists: snapshot.exists(), data: snapshot.val(), path });
          } catch (error) {
            console.error(`Error in org database listener for ${slug}/${path}:`, error);
          }
        });
        return () => {
          ref.off('value');
        };
      } catch (error) {
        throw this.handleDatabaseError(error, 'on', slug, path);
      }
    }

    handleAuthError(error) {
      const authErrors = {
        'auth/invalid-email': 'Invalid email address',
        'auth/weak-password': 'Password should be at least 6 characters',
        'auth/email-already-in-use': 'Email is already registered',
        'auth/user-not-found': 'User not found',
        'auth/wrong-password': 'Incorrect password',
        'auth/user-disabled': 'User account is disabled',
        'auth/operation-not-allowed': 'Operation not allowed',
        'auth/too-many-requests': 'Too many login attempts. Try again later'
      };
      const message = authErrors[error.code] || error.message;
      const authError = new Error(message);
      authError.code = error.code;
      authError.originalError = error;
      return authError;
    }

    handleFirestoreError(error, operation, collection, documentId = '') {
      const fsErrors = {
        'permission-denied': `Permission denied for ${operation} on ${collection}`,
        'not-found': `Document not found in ${collection}`,
        'already-exists': `Document already exists in ${collection}`,
        'failed-precondition': `Failed precondition for ${operation} on ${collection}`,
        'invalid-argument': `Invalid argument for ${operation} on ${collection}`,
        'resource-exhausted': 'Database operation quota exceeded. Try again later',
        'unavailable': 'Firebase service temporarily unavailable',
        'internal': 'Internal Firebase error'
      };
      const message = fsErrors[error.code] || error.message;
      const fsError = new Error(message);
      fsError.code = error.code;
      fsError.operation = operation;
      fsError.collection = collection;
      fsError.documentId = documentId;
      fsError.originalError = error;
      return fsError;
    }

    handleDatabaseError(error, operation, slug, path = '') {
      const dbErrors = {
        'permission-denied': `Permission denied for ${operation} on ${slug}/${path}`,
        'instance-not-found': `Database instance not found for ${slug}`,
        'write-canceled': `Write operation canceled for ${slug}/${path}`,
        'unavailable': 'Database service temporarily unavailable'
      };
      const message = dbErrors[error.code] || error.message;
      const dbError = new Error(message);
      dbError.code = error.code;
      dbError.operation = operation;
      dbError.slug = slug;
      dbError.path = path;
      dbError.originalError = error;
      return dbError;
    }
  }

  beforeEach(() => {
    firebaseService = new MockFirebaseService();

    // Mock central auth
    mockCentralAuth = {
      createUserWithEmailAndPassword: vi.fn(),
      signInWithEmailAndPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChanged: vi.fn((callback) => callback(null))
    };

    // Mock central firestore
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
        })),
        get: vi.fn(),
        where: vi.fn(function() {
          return this;
        })
      }))
    };
  });

  describe('initialization', () => {
    it('should initialize with central Firebase instances', async () => {
      await firebaseService.initializeCentral(mockCentralAuth, mockCentralFirestore);

      expect(firebaseService.centralAuth).toBe(mockCentralAuth);
      expect(firebaseService.centralFirestore).toBe(mockCentralFirestore);
    });

    it('should throw error if instances are missing', async () => {
      try {
        await firebaseService.initializeCentral(null, mockCentralFirestore);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('required');
      }
    });
  });

  describe('central auth operations', () => {
    beforeEach(async () => {
      await firebaseService.initializeCentral(mockCentralAuth, mockCentralFirestore);
    });

    it('should create user with email and password', async () => {
      mockCentralAuth.createUserWithEmailAndPassword.mockResolvedValueOnce({
        user: {
          uid: 'user123',
          email: 'test@example.com',
          displayName: null,
          photoURL: null
        }
      });

      const result = await firebaseService.createUserWithEmailAndPassword(
        'test@example.com',
        'password123'
      );

      expect(result.uid).toBe('user123');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw error for invalid email in sign up', async () => {
      try {
        await firebaseService.createUserWithEmailAndPassword(null, 'password');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('required');
      }
    });

    it('should sign in with email and password', async () => {
      mockCentralAuth.signInWithEmailAndPassword.mockResolvedValueOnce({
        user: {
          uid: 'user123',
          email: 'test@example.com',
          displayName: 'Test User',
          photoURL: null
        }
      });

      const result = await firebaseService.signInWithEmailAndPassword(
        'test@example.com',
        'password123'
      );

      expect(result.uid).toBe('user123');
      expect(result.displayName).toBe('Test User');
    });

    it('should sign out', async () => {
      mockCentralAuth.signOut.mockResolvedValueOnce(undefined);

      const result = await firebaseService.signOut();

      expect(result).toBe(true);
      expect(mockCentralAuth.signOut).toHaveBeenCalled();
    });

    it('should subscribe to auth state changes', () => {
      const callback = vi.fn();

      firebaseService.onAuthStateChanged(callback);

      expect(mockCentralAuth.onAuthStateChanged).toHaveBeenCalled();
    });

    it('should throw error for invalid callback', () => {
      expect(() => {
        firebaseService.onAuthStateChanged(null);
      }).toThrow('Callback must be a function');
    });

    it('should handle auth errors', async () => {
      const authError = new Error('auth/email-already-in-use');
      authError.code = 'auth/email-already-in-use';

      mockCentralAuth.createUserWithEmailAndPassword.mockRejectedValueOnce(authError);

      try {
        await firebaseService.createUserWithEmailAndPassword('test@example.com', 'password');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('already registered');
        expect(error.code).toBe('auth/email-already-in-use');
      }
    });
  });

  describe('central firestore operations', () => {
    beforeEach(async () => {
      await firebaseService.initializeCentral(mockCentralAuth, mockCentralFirestore);
    });

    it('should get document from firestore', async () => {
      const docMock = {
        exists: true,
        data: () => ({ name: 'Test Org', slug: 'test-org' }),
        id: 'org123'
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce({
          get: vi.fn().mockResolvedValueOnce(docMock)
        })
      });

      const result = await firebaseService.centralGet('organizations', 'org123');

      expect(result.exists).toBe(true);
      expect(result.data.name).toBe('Test Org');
      expect(result.id).toBe('org123');
    });

    it('should set document in firestore', async () => {
      const docMock = {
        set: vi.fn().mockResolvedValueOnce(undefined)
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce(docMock)
      });

      const data = { name: 'New Org', slug: 'new-org' };
      const result = await firebaseService.centralSet('organizations', 'org123', data);

      expect(docMock.set).toHaveBeenCalled();
      expect(result.id).toBe('org123');
      expect(result.name).toBe('New Org');
    });

    it('should update document in firestore', async () => {
      const docMock = {
        update: vi.fn().mockResolvedValueOnce(undefined)
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce(docMock)
      });

      const updates = { status: 'inactive' };
      const result = await firebaseService.centralUpdate('organizations', 'org123', updates);

      expect(docMock.update).toHaveBeenCalledWith(updates);
      expect(result.id).toBe('org123');
    });

    it('should delete document from firestore', async () => {
      const docMock = {
        delete: vi.fn().mockResolvedValueOnce(undefined)
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce(docMock)
      });

      const result = await firebaseService.centralDelete('organizations', 'org123');

      expect(docMock.delete).toHaveBeenCalled();
      expect(result.deleted).toBe(true);
    });

    it('should throw error for missing parameters in get', async () => {
      try {
        await firebaseService.centralGet(null, 'doc123');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('required');
      }
    });
  });

  describe('nested firestore operations', () => {
    beforeEach(async () => {
      await firebaseService.initializeCentral(mockCentralAuth, mockCentralFirestore);
    });

    it('should create nested document', async () => {
      const nestedDocMock = {
        set: vi.fn().mockResolvedValueOnce(undefined)
      };

      const subcollectionMock = {
        doc: vi.fn().mockReturnValueOnce(nestedDocMock)
      };

      const docMock = {
        collection: vi.fn().mockReturnValueOnce(subcollectionMock)
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce(docMock)
      });

      const memberData = { email: 'member@example.com', role: 'editor' };
      const result = await firebaseService.centralCreateNested(
        'organizations',
        'org123',
        'members',
        'user456',
        memberData
      );

      expect(nestedDocMock.set).toHaveBeenCalledWith(memberData);
      expect(result.parentId).toBe('org123');
      expect(result.nestedId).toBe('user456');
    });

    it('should get nested document', async () => {
      const nestedDocMock = {
        exists: true,
        data: () => ({ email: 'member@example.com', role: 'editor' }),
        id: 'user456'
      };

      const subcollectionMock = {
        doc: vi.fn().mockReturnValueOnce({
          get: vi.fn().mockResolvedValueOnce(nestedDocMock)
        })
      };

      const docMock = {
        collection: vi.fn().mockReturnValueOnce(subcollectionMock)
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce(docMock)
      });

      const result = await firebaseService.centralGetNested(
        'organizations',
        'org123',
        'members',
        'user456'
      );

      expect(result.exists).toBe(true);
      expect(result.data.role).toBe('editor');
    });
  });

  describe('organization firebase operations', () => {
    it('should register organization instance', () => {
      const mockApp = { name: 'org_test' };
      const mockDatabase = { ref: () => ({}) };

      const result = firebaseService.registerOrgInstance('test-org', mockApp, mockDatabase);

      expect(result).toBe(true);
      expect(firebaseService.getOrgInstance('test-org')).toBeDefined();
    });

    it('should throw error for missing parameters in registration', () => {
      expect(() => {
        firebaseService.registerOrgInstance(null, {}, {});
      }).toThrow('required');
    });

    it('should get registered organization instance', () => {
      const mockApp = { name: 'org_test' };
      const mockDatabase = { ref: () => ({}) };

      firebaseService.registerOrgInstance('test-org', mockApp, mockDatabase);
      const instance = firebaseService.getOrgInstance('test-org');

      expect(instance.app).toBe(mockApp);
      expect(instance.database).toBe(mockDatabase);
    });

    it('should throw error for unregistered organization', () => {
      expect(() => {
        firebaseService.getOrgInstance('nonexistent-org');
      }).toThrow('No Firebase instance registered');
    });
  });

  describe('organization database operations', () => {
    beforeEach(() => {
      const mockApp = { name: 'org_test' };
      const mockDatabase = {
        ref: vi.fn(() => ({
          set: vi.fn(),
          get: vi.fn(),
          update: vi.fn(),
          remove: vi.fn(),
          on: vi.fn()
        }))
      };

      firebaseService.registerOrgInstance('test-org', mockApp, mockDatabase);
    });

    it('should set data in organization database', async () => {
      const mockDatabase = firebaseService.getOrgInstance('test-org').database;
      const refMock = {
        set: vi.fn().mockResolvedValueOnce(undefined)
      };
      mockDatabase.ref.mockReturnValueOnce(refMock);

      const data = { count: 5, name: 'Test' };
      const result = await firebaseService.orgDatabaseSet('test-org', 'counts/2026-02', data);

      expect(refMock.set).toHaveBeenCalledWith(data);
      expect(result.data).toEqual(data);
    });

    it('should get data from organization database', async () => {
      const mockDatabase = firebaseService.getOrgInstance('test-org').database;
      const refMock = {
        get: vi.fn().mockResolvedValueOnce({
          exists: () => true,
          val: () => ({ count: 5 })
        })
      };
      mockDatabase.ref.mockReturnValueOnce(refMock);

      const result = await firebaseService.orgDatabaseGet('test-org', 'counts/2026-02');

      expect(result.exists).toBe(true);
      expect(result.data.count).toBe(5);
    });

    it('should update data in organization database', async () => {
      const mockDatabase = firebaseService.getOrgInstance('test-org').database;
      const refMock = {
        update: vi.fn().mockResolvedValueOnce(undefined)
      };
      mockDatabase.ref.mockReturnValueOnce(refMock);

      const updates = { count: 10 };
      const result = await firebaseService.orgDatabaseUpdate('test-org', 'counts/2026-02', updates);

      expect(refMock.update).toHaveBeenCalledWith(updates);
      expect(result.updates).toEqual(updates);
    });

    it('should delete data from organization database', async () => {
      const mockDatabase = firebaseService.getOrgInstance('test-org').database;
      const refMock = {
        remove: vi.fn().mockResolvedValueOnce(undefined)
      };
      mockDatabase.ref.mockReturnValueOnce(refMock);

      const result = await firebaseService.orgDatabaseDelete('test-org', 'counts/2026-02');

      expect(refMock.remove).toHaveBeenCalled();
      expect(result.deleted).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle auth errors with friendly messages', async () => {
      await firebaseService.initializeCentral(mockCentralAuth, mockCentralFirestore);

      const authError = new Error('auth/email-already-in-use');
      authError.code = 'auth/email-already-in-use';

      mockCentralAuth.createUserWithEmailAndPassword.mockRejectedValueOnce(authError);

      try {
        await firebaseService.createUserWithEmailAndPassword('test@example.com', 'password');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('already registered');
        expect(error.code).toBe('auth/email-already-in-use');
      }
    });

    it('should handle firestore permission errors', async () => {
      await firebaseService.initializeCentral(mockCentralAuth, mockCentralFirestore);

      const fsError = new Error('permission-denied');
      fsError.code = 'permission-denied';

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce({
          get: vi.fn().mockRejectedValueOnce(fsError)
        })
      });

      try {
        await firebaseService.centralGet('organizations', 'org123');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('Permission denied');
        expect(error.code).toBe('permission-denied');
      }
    });
  });
});
