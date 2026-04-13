import FirebaseService from './firebase-service.js';

/**
 * Super Admin Service
 * Handles organization creation and management
 * Depends on FirebaseService for central database operations
 * 
 * TODO: Integrate with actual app initialization code to provide Firebase instances
 * Services currently use dependency injection but are instantiated without parameters
 */

class SuperAdminService {
  constructor(firebaseService = null) {
    // Dependency injection with default
    this.firebaseService = firebaseService || FirebaseService.getInstance();
  }

  async initialize() {
    // FirebaseService initialization is handled independently
    return true;
  }

  async createOrganization(orgName, firebaseConfig, adminEmail, adminPassword) {
    try {
      if (!firebaseConfig || !firebaseConfig.projectId) {
        throw new Error('Valid Firebase config required for organization');
      }

      const slug = this.generateSlug(orgName);
      const orgId = this.generateId();

      // Check if slug exists in Firestore using FirebaseService
      const existingOrgResult = await this.firebaseService.centralGet('organizations', slug);

      if (existingOrgResult.exists) {
        throw new Error(`Organization slug already exists: ${slug}`);
      }

      // Initialize organization's own Firebase to create admin user there
      const orgAppName = `init_${slug}_${Date.now()}`;
      const orgFirebaseApp = firebase.initializeApp(firebaseConfig, orgAppName);
      const orgAuth = firebase.auth(orgFirebaseApp);
      const orgDatabase = firebase.database(orgFirebaseApp);

      // Create admin user in organization's Firebase
      let adminUid;
      let adminUser;

      try {
        // Try to create the user
        adminUser = await orgAuth.createUserWithEmailAndPassword(adminEmail, adminPassword);
        adminUid = adminUser.user.uid;
      } catch (authError) {
        // If email already exists, try to sign in with the provided password
        if (authError.code === 'auth/email-already-in-use') {
          try {
            adminUser = await orgAuth.signInWithEmailAndPassword(adminEmail, adminPassword);
            adminUid = adminUser.user.uid;
          } catch (signInError) {
            throw new Error(`Email already in use and password does not match. Please use a different email or verify the password.`);
          }
        } else {
          throw authError;
        }
      }

      // Add admin to users in organization's Realtime Database
      await orgDatabase.ref(`users/${adminUid}`).set({
        email: adminEmail,
        role: 'admin',
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });

      // Create organization metadata in central Firestore using FirebaseService
      const orgData = {
        id: orgId,
        name: orgName,
        slug: slug,
        firebaseConfig: firebaseConfig,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      await this.firebaseService.centralSet('organizations', slug, orgData);

      // Clean up temporary Firebase instance
      await firebase.app(orgAppName).delete();

      return {
        ...orgData,
        adminUser: {
          uid: adminUid,
          email: adminEmail
        }
      };
    } catch (error) {
      throw error;
    }
  }

  async getAllOrganizations() {
    try {
      // Get all organizations from central Firestore using FirebaseService
      const organizations = await this.firebaseService.centralGetAll('organizations');
      
      return organizations;
    } catch (error) {
      throw error;
    }
  }

  async updateOrgStatus(slug, status) {
    try {
      if (!slug) {
        throw new Error('Organization slug is required');
      }

      // If status is 'deleted', completely remove from Firestore using FirebaseService
      if (status === 'deleted') {
        await this.firebaseService.centralDelete('organizations', slug);
      } else {
        // For other statuses, just update the status field using FirebaseService
        await this.firebaseService.centralUpdate('organizations', slug, {
          status: status,
          updatedAt: new Date().toISOString()
        });
      }

      return { slug, status };
    } catch (error) {
      throw error;
    }
  }

  async updateOrganization(slug, updates) {
    try {
      if (!slug) {
        throw new Error('Organization slug is required');
      }

      // Update organization fields in Firestore using FirebaseService
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await this.firebaseService.centralUpdate('organizations', slug, updateData);
      return { slug, ...updates };
    } catch (error) {
      throw error;
    }
  }

  generateSlug(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  }

  generateId() {
    return `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static getInstance() {
    if (!SuperAdminService.instance) {
      SuperAdminService.instance = new SuperAdminService();
    }
    return SuperAdminService.instance;
  }
}

const superAdminService = SuperAdminService.getInstance();

export default SuperAdminService;
