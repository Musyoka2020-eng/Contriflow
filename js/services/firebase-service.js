/**
 * Firebase Service
 * Centralized layer for ALL database operations
 * Single point of contact between app and Firebase
 * 
 * Handles:
 * - Central Firestore operations
 * - Central Auth operations
 * - Organization-specific Firebase operations
 * - Error handling and validation
 */

class FirebaseService {
  constructor() {
    this.centralFirestore = null;
    this.centralAuth = null;
    this.orgFirebaseInstances = {}; // Map of slug -> { app, database }
  }

  /**
   * Initialize central Firebase instances
   * @param {object} auth - Firebase Auth instance (optional)
   * @param {object} firestore - Firestore instance (required)
   */
  async initializeCentral(auth, firestore) {
    if (!firestore) {
      throw new Error('Central Firestore instance is required');
    }

    this.centralAuth = auth || null; // Auth is optional
    this.centralFirestore = firestore;
    return true;
  }

  // ============================================
  // CENTRAL AUTH OPERATIONS
  // ============================================

  /**
   * Create user with email and password
   */
  async createUserWithEmailAndPassword(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (!this.centralAuth) {
      throw new Error('Firebase Auth not initialized');
    }

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

  /**
   * Sign in with email and password
   */
  async signInWithEmailAndPassword(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (!this.centralAuth) {
      throw new Error('Firebase Auth not initialized');
    }

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

  /**
   * Sign out current user
   */
  async signOut() {
    if (!this.centralAuth) {
      throw new Error('Firebase Auth not initialized');
    }

    try {
      await this.centralAuth.signOut();
      return true;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback) {
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.centralAuth) {
      // Auth not initialized, call callback with null user
      callback(null);
      return () => {}; // Empty unsubscribe function
    }

    return this.centralAuth.onAuthStateChanged((user) => {
      try {
        callback(user);
      } catch (error) {
        console.error('Error in auth state change callback:', error);
      }
    });
  }

  // ============================================
  // CENTRAL FIRESTORE OPERATIONS
  // ============================================

  /**
   * Get document from central Firestore
   */
  async centralGet(collection, documentId) {
    if (!collection || !documentId) {
      throw new Error('Collection and document ID are required');
    }

    try {
      const docSnapshot = await this.centralFirestore
        .collection(collection)
        .doc(documentId)
        .get();

      return {
        exists: docSnapshot.exists,
        data: docSnapshot.exists ? docSnapshot.data() : null,
        id: docSnapshot.id
      };
    } catch (error) {
      throw this.handleFirestoreError(error, 'get', collection, documentId);
    }
  }

  /**
   * Get all documents from a collection (with optional query)
   */
  async centralGetAll(collection, whereConditions = []) {
    if (!collection) {
      throw new Error('Collection is required');
    }

    try {
      let query = this.centralFirestore.collection(collection);

      // Apply where conditions
      whereConditions.forEach(({ field, operator, value }) => {
        query = query.where(field, operator, value);
      });

      const snapshot = await query.get();
      const documents = [];

      snapshot.forEach((doc) => {
        documents.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return documents;
    } catch (error) {
      throw this.handleFirestoreError(error, 'getAll', collection);
    }
  }

  /**
   * Create/set document in central Firestore
   */
  async centralSet(collection, documentId, data, merge = false) {
    if (!collection || !documentId || !data) {
      throw new Error('Collection, document ID, and data are required');
    }

    try {
      await this.centralFirestore
        .collection(collection)
        .doc(documentId)
        .set(data, { merge });

      return {
        id: documentId,
        ...data
      };
    } catch (error) {
      throw this.handleFirestoreError(error, 'set', collection, documentId);
    }
  }

  /**
   * Update document in central Firestore
   */
  async centralUpdate(collection, documentId, updates) {
    if (!collection || !documentId || !updates) {
      throw new Error('Collection, document ID, and updates are required');
    }

    try {
      await this.centralFirestore
        .collection(collection)
        .doc(documentId)
        .update(updates);

      return {
        id: documentId,
        ...updates
      };
    } catch (error) {
      throw this.handleFirestoreError(error, 'update', collection, documentId);
    }
  }

  /**
   * Delete document from central Firestore
   */
  async centralDelete(collection, documentId) {
    if (!collection || !documentId) {
      throw new Error('Collection and document ID are required');
    }

    try {
      await this.centralFirestore
        .collection(collection)
        .doc(documentId)
        .delete();

      return { id: documentId, deleted: true };
    } catch (error) {
      throw this.handleFirestoreError(error, 'delete', collection, documentId);
    }
  }

  /**
   * Create nested document (subcollection)
   */
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

      return {
        parentId: documentId,
        nestedId: nestedId,
        ...data
      };
    } catch (error) {
      throw this.handleFirestoreError(error, 'createNested', collection, documentId);
    }
  }

  /**
   * Get nested document (from subcollection)
   */
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

  /**
   * Get all nested documents
   */
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
        documents.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return documents;
    } catch (error) {
      throw this.handleFirestoreError(error, 'getAllNested', collection, documentId);
    }
  }

  /**
   * Update nested document
   */
  async centralUpdateNested(collection, documentId, subcollection, nestedId, updates) {
    if (!collection || !documentId || !subcollection || !nestedId || !updates) {
      throw new Error('All parameters are required for nested update');
    }

    try {
      await this.centralFirestore
        .collection(collection)
        .doc(documentId)
        .collection(subcollection)
        .doc(nestedId)
        .update(updates);

      return {
        parentId: documentId,
        nestedId: nestedId,
        ...updates
      };
    } catch (error) {
      throw this.handleFirestoreError(error, 'updateNested', collection, documentId);
    }
  }

  /**
   * Delete nested document
   */
  async centralDeleteNested(collection, documentId, subcollection, nestedId) {
    if (!collection || !documentId || !subcollection || !nestedId) {
      throw new Error('All parameters are required for nested delete');
    }

    try {
      await this.centralFirestore
        .collection(collection)
        .doc(documentId)
        .collection(subcollection)
        .doc(nestedId)
        .delete();

      return { parentId: documentId, nestedId: nestedId, deleted: true };
    } catch (error) {
      throw this.handleFirestoreError(error, 'deleteNested', collection, documentId);
    }
  }

  // ============================================
  // ORGANIZATION FIREBASE OPERATIONS
  // ============================================

  /**
   * Register organization Firebase instance
   * Called after org's Firebase is initialized
   */
  registerOrgInstance(slug, firebaseApp, database) {
    if (!slug || !firebaseApp || !database) {
      throw new Error('Slug, Firebase app, and database are required');
    }

    this.orgFirebaseInstances[slug] = {
      app: firebaseApp,
      database: database
    };

    return true;
  }

  /**
   * Get organization Firebase instance
   */
  getOrgInstance(slug) {
    if (!slug) {
      throw new Error('Organization slug is required');
    }

    const instance = this.orgFirebaseInstances[slug];
    if (!instance) {
      throw new Error(`No Firebase instance registered for organization: ${slug}`);
    }

    return instance;
  }

  /**
   * Write data to organization Realtime Database
   */
  async orgDatabaseSet(slug, path, data) {
    if (!slug || !path || !data) {
      throw new Error('Slug, path, and data are required');
    }

    try {
      const { database } = this.getOrgInstance(slug);
      await database.ref(path).set(data);

      return { slug, path, data };
    } catch (error) {
      throw this.handleDatabaseError(error, 'set', slug, path);
    }
  }

  /**
   * Read data from organization Realtime Database
   */
  async orgDatabaseGet(slug, path) {
    if (!slug || !path) {
      throw new Error('Slug and path are required');
    }

    try {
      const { database } = this.getOrgInstance(slug);
      const snapshot = await database.ref(path).get();

      return {
        exists: snapshot.exists(),
        data: snapshot.exists() ? snapshot.val() : null,
        path
      };
    } catch (error) {
      throw this.handleDatabaseError(error, 'get', slug, path);
    }
  }

  /**
   * Update data in organization Realtime Database
   */
  async orgDatabaseUpdate(slug, path, updates) {
    if (!slug || !path || !updates) {
      throw new Error('Slug, path, and updates are required');
    }

    try {
      const { database } = this.getOrgInstance(slug);
      await database.ref(path).update(updates);

      return { slug, path, updates };
    } catch (error) {
      throw this.handleDatabaseError(error, 'update', slug, path);
    }
  }

  /**
   * Delete data from organization Realtime Database
   */
  async orgDatabaseDelete(slug, path) {
    if (!slug || !path) {
      throw new Error('Slug and path are required');
    }

    try {
      const { database } = this.getOrgInstance(slug);
      await database.ref(path).remove();

      return { slug, path, deleted: true };
    } catch (error) {
      throw this.handleDatabaseError(error, 'delete', slug, path);
    }
  }

  /**
   * Subscribe to changes in organization Realtime Database
   */
  onOrgDatabaseChange(slug, path, callback) {
    if (!slug || !path || !callback) {
      throw new Error('Slug, path, and callback are required');
    }

    try {
      const { database } = this.getOrgInstance(slug);
      const ref = database.ref(path);

      const listener = ref.on('value', (snapshot) => {
        try {
          callback({
            exists: snapshot.exists(),
            data: snapshot.val(),
            path
          });
        } catch (error) {
          console.error(`Error in org database listener for ${slug}/${path}:`, error);
        }
      });

      // Return unsubscribe function
      return () => {
        ref.off('value', listener);
      };
    } catch (error) {
      throw this.handleDatabaseError(error, 'on', slug, path);
    }
  }

  // ============================================
  // ERROR HANDLING
  // ============================================

  /**
   * Handle Auth errors
   */
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

  /**
   * Handle Firestore errors
   */
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

  /**
   * Handle Realtime Database errors
   */
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

  // ============================================
  // SINGLETON
  // ============================================

  static getInstance() {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  static resetInstance() {
    FirebaseService.instance = null;
  }
}

const firebaseService = FirebaseService.getInstance();

export default FirebaseService;
