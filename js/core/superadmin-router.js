/**
 * Super Admin Router
 * Handles routing for super admin pages
 * Validates super admin access and manages admin routes
 */

class SuperAdminRouter {
  constructor() {
    this.authService = AuthService.getInstance();
    this.superAdminService = SuperAdminService.getInstance();
    this.centralAuth = null;
    this.centralFirestore = null;
  }

  async initialize(centralAuth, centralFirestore) {
    this.centralAuth = centralAuth;
    this.centralFirestore = centralFirestore;

    // Check auth state
    this.centralAuth.onAuthStateChanged((user) => {
      this.handleAuthStateChange(user);
    });
  }

  async handleAuthStateChange(user) {
    try {
      const currentPath = window.location.pathname;

      if (!user) {
        // User not authenticated
        if (!currentPath.includes('/superadmin/login')) {
          window.location.href = '/superadmin/login.html';
        }
        return;
      }

      // User is authenticated, check if super admin
      const isSuperAdmin = await this.checkSuperAdminStatus(user.uid);

      if (!isSuperAdmin) {
        await this.centralAuth.signOut();
        window.location.href = '/superadmin/login.html';
        return;
      }

      // User is super admin

      // Redirect from login to dashboard if on login page
      if (currentPath.includes('/superadmin/login')) {
        window.location.href = '/superadmin/dashboard.html';
      }

      // Fire event for pages to know admin is ready
      document.dispatchEvent(new CustomEvent('superadmin:ready', { detail: { user } }));
    } catch (error) {
      console.error('Auth state change handling failed:', error);
    }
  }

  async checkSuperAdminStatus(userId) {
    try {
      const doc = await this.centralFirestore.collection('superadminUsers').doc(userId).get();
      return doc.exists;
    } catch (error) {
      console.error('Failed to check super admin status:', error);
      return false;
    }
  }

  async login(email, password) {
    try {
      const result = await this.centralAuth.signInWithEmailAndPassword(email, password);
      const user = result.user;

      // Check if super admin
      const isSuperAdmin = await this.checkSuperAdminStatus(user.uid);

      if (!isSuperAdmin) {
        await this.centralAuth.signOut();
        throw new Error('User is not a super admin');
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  async logout() {
    try {
      await this.centralAuth.signOut();
      window.location.href = '/superadmin/login.html';
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  static getInstance() {
    if (!SuperAdminRouter.instance) {
      SuperAdminRouter.instance = new SuperAdminRouter();
    }
    return SuperAdminRouter.instance;
  }
}

const superAdminRouter = SuperAdminRouter.getInstance();
