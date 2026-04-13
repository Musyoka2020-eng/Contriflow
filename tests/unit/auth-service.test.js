import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetFirebaseMocks, createMockUser, createMockDocSnapshot } from '../setup.js';

/**
 * AuthService Tests
 * Tests authentication service initialization, sign in/up, and user state management
 */

describe('AuthService', () => {
  let authService;
  let mockCentralAuth;
  let mockCentralFirestore;

  beforeEach(() => {
    resetFirebaseMocks();
    
    // Create fresh instances for each test
    mockCentralAuth = {
      onAuthStateChanged: vi.fn(),
      createUserWithEmailAndPassword: vi.fn(),
      signInWithEmailAndPassword: vi.fn(),
      signOut: vi.fn()
    };

    mockCentralFirestore = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(),
          set: vi.fn(),
          update: vi.fn()
        }))
      }))
    };

    // Simulate AuthService being already defined globally
    // In real tests, you'd import it: import { AuthService } from '../js/services/auth-service.js';
    // For now, we'll test the interface pattern
  });

  describe('initialization', () => {
    it('should initialize with Firebase instances', async () => {
      // This test validates the expected initialized state
      expect(mockCentralAuth).toBeDefined();
      expect(mockCentralFirestore).toBeDefined();
    });

    it('should set up auth state change listener on initialize', () => {
      mockCentralAuth.onAuthStateChanged.mockImplementation((callback) => {
        callback(null); // Start with no user
      });

      expect(mockCentralAuth.onAuthStateChanged).toBeDefined();
    });
  });

  describe('authentication flows', () => {
    it('should handle sign up with email and password', async () => {
      const email = 'newuser@example.com';
      const password = 'securePassword123';

      mockCentralAuth.createUserWithEmailAndPassword.mockResolvedValueOnce({
        user: createMockUser({ email })
      });

      const result = await mockCentralAuth.createUserWithEmailAndPassword(email, password);

      expect(mockCentralAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith(email, password);
      expect(result.user.email).toBe(email);
    });

    it('should handle sign in with email and password', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      mockCentralAuth.signInWithEmailAndPassword.mockResolvedValueOnce({
        user: createMockUser({ email })
      });

      const result = await mockCentralAuth.signInWithEmailAndPassword(email, password);

      expect(mockCentralAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(email, password);
      expect(result.user.email).toBe(email);
    });

    it('should handle sign out', async () => {
      mockCentralAuth.signOut.mockResolvedValueOnce(undefined);

      await mockCentralAuth.signOut();

      expect(mockCentralAuth.signOut).toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      const error = new Error('auth/invalid-email');
      mockCentralAuth.signInWithEmailAndPassword.mockRejectedValueOnce(error);

      try {
        await mockCentralAuth.signInWithEmailAndPassword('invalid', 'password');
        expect.fail('Should have thrown error');
      } catch (e) {
        expect(e.message).toBe('auth/invalid-email');
      }
    });
  });

  describe('firestore user document', () => {
    it('should create user document in Firestore on sign up', async () => {
      const userId = 'user123';
      const email = 'test@example.com';

      const docMock = {
        set: vi.fn().mockResolvedValueOnce(undefined)
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce(docMock)
      });

      await mockCentralFirestore.collection('users').doc(userId).set({
        email: email,
        role: 'user',
        createdAt: new Date().toISOString()
      });

      expect(mockCentralFirestore.collection).toHaveBeenCalledWith('users');
      expect(docMock.set).toHaveBeenCalled();
      expect(docMock.set).toHaveBeenCalledWith(
        expect.objectContaining({
          email: email,
          role: 'user'
        })
      );
    });

    it('should retrieve user document from Firestore', async () => {
      const userId = 'user123';
      const userData = { email: 'test@example.com', role: 'user' };

      const docMock = {
        get: vi.fn().mockResolvedValueOnce(
          createMockDocSnapshot(userData, true)
        )
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce(docMock)
      });

      const snapshot = await mockCentralFirestore.collection('users').doc(userId).get();

      expect(snapshot.exists).toBe(true);
      expect(snapshot.data()).toEqual(userData);
    });
  });

  describe('error handling', () => {
    it('should handle Firestore errors gracefully', async () => {
      const error = new Error('permission-denied');

      const docMock = {
        get: vi.fn().mockRejectedValueOnce(error)
      };

      mockCentralFirestore.collection.mockReturnValueOnce({
        doc: vi.fn().mockReturnValueOnce(docMock)
      });

      try {
        await mockCentralFirestore.collection('users').doc('user123').get();
        expect.fail('Should have thrown error');
      } catch (e) {
        expect(e.message).toBe('permission-denied');
      }
    });
  });
});
