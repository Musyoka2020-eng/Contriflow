import FirebaseService from './firebase-service.js';
import OrgManager from './org-manager.js';

/**
 * Authentication Service
 * Handles multi-tenant authentication
 * Depends on FirebaseService for database operations
 * Optionally updates StateManager with authentication state
 */

class AuthService {
  constructor(firebaseService = null, orgManager = null, stateManager = null) {
    // Dependency injection with defaults
    this.firebaseService = firebaseService || FirebaseService.getInstance();
    this.orgManager = orgManager || OrgManager.getInstance();
    this.stateManager = stateManager || null; // Optional StateManager for state updates
    
    this.currentUser = null;
    this.currentUserRole = null;
    this.userOrganizations = [];
  }

  async initialize() {
    // Subscribe to auth state changes
    this.firebaseService.onAuthStateChanged(async (user) => {
      if (user) {
        await this.handleUserSignIn(user);
      } else {
        await this.handleUserSignOut();
      }
    });

    return true;
  }

  async handleUserSignIn(user) {
    try {
      this.currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      };

      // Get user document from Firestore using FirebaseService
      const userDocResult = await this.firebaseService.centralGet('users', user.uid);

      if (userDocResult.exists) {
        const userData = userDocResult.data;
        this.currentUserRole = userData.role || 'user';
      } else {
        // Create user document in Firestore using FirebaseService
        await this.firebaseService.centralSet('users', user.uid, {
          email: user.email,
          role: 'user',
          createdAt: new Date().toISOString()
        });
        this.currentUserRole = 'user';
      }

      await this.orgManager.loadUserOrganizations(user.uid);
      this.userOrganizations = this.orgManager.userOrganizations;

      // Update StateManager if available
      if (this.stateManager) {
        this.stateManager.setCurrentUser(this.currentUser);
        this.stateManager.setUserRole(this.currentUserRole);
        this.stateManager.setUserOrganizations(this.userOrganizations);
      }
    } catch (error) {
      if (this.stateManager) {
        this.stateManager.setError('Failed to load user data: ' + error.message);
      }
      throw error;
    }
  }

  async handleUserSignOut() {
    this.currentUser = null;
    this.currentUserRole = null;
    this.userOrganizations = [];
    this.orgManager.clearCurrentOrg();

    // Update StateManager if available
    if (this.stateManager) {
      this.stateManager.clearUserData();
    }
  }

  async signUp(email, password) {
    try {
      // Use FirebaseService for user creation
      const userResult = await this.firebaseService.createUserWithEmailAndPassword(email, password);

      // Create user document in Firestore using FirebaseService
      await this.firebaseService.centralSet('users', userResult.uid, {
        email: email,
        role: 'user',
        createdAt: new Date().toISOString()
      });

      return { uid: userResult.uid, email: userResult.email };
    } catch (error) {
      throw error;
    }
  }

  async signIn(email, password) {
    try {
      // Use FirebaseService for sign in
      const user = await this.firebaseService.signInWithEmailAndPassword(email, password);
      return user;
    } catch (error) {
      throw error;
    }
  }

  async signOut() {
    try {
      // Use FirebaseService for sign out
      await this.firebaseService.signOut();
    } catch (error) {
      throw error;
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentUserRole() {
    return this.currentUserRole;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  isSuperAdmin() {
    return this.currentUserRole === 'superadmin';
  }

  getUserOrganizations() {
    return this.userOrganizations;
  }

  canAccessOrg(orgSlug) {
    if (this.isSuperAdmin()) return true;
    return this.userOrganizations.some(org => org.slug === orgSlug);
  }

  hasRoleInOrg(orgSlug, requiredRole) {
    if (this.isSuperAdmin()) return true;

    const org = this.userOrganizations.find(o => o.slug === orgSlug);
    if (!org) return false;

    const members = org.members || {};
    const userRole = members[this.currentUser.uid];
    if (!userRole) return false;

    const roleHierarchy = { admin: 3, editor: 2, viewer: 1 };
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  static getInstance() {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
}

const authService = AuthService.getInstance();

export default AuthService;
