/**
 * Super Admin Service
 * Handles organization creation and management
 * Uses Firestore for central database
 */

class SuperAdminService {
  constructor() {
    this.centralFirestore = null;
    this.centralAuth = null;
  }

  async initialize(centralFirestore, centralAuth) {
    this.centralFirestore = centralFirestore;
    this.centralAuth = centralAuth;
  }

  async createOrganization(orgName, firebaseConfig, adminEmail, adminPassword) {
    try {
      if (!firebaseConfig || !firebaseConfig.projectId) {
        throw new Error('Valid Firebase config required for organization');
      }

      const slug = this.generateSlug(orgName);
      const orgId = this.generateId();

      // Check if slug exists in Firestore
      const orgRef = firebase.firestore().collection('organizations').doc(slug);
      const existingOrg = await orgRef.get();

      if (existingOrg.exists) {
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

      // Create organization metadata in central Firestore
      const orgData = {
        id: orgId,
        name: orgName,
        slug: slug,
        firebaseConfig: firebaseConfig,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      await this.centralFirestore.collection('organizations').doc(slug).set(orgData);

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
      console.error('Failed to create organization:', error);
      throw error;
    }
  }

  async getAllOrganizations() {
    try {
      const db = this.centralFirestore;
      const querySnapshot = await db.collection('organizations').get();

      const organizations = [];
      querySnapshot.forEach((doc) => {
        organizations.push({
          slug: doc.id,
          ...doc.data()
        });
      });

      return organizations;
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
      throw error;
    }
  }

  async updateOrgStatus(slug, status) {
    try {
      if (!slug) {
        throw new Error('Organization slug is required');
      }

      const db = this.centralFirestore;
      
      // If status is 'deleted', completely remove from Firestore
      if (status === 'deleted') {
        await db.collection('organizations').doc(slug).delete();
      } else {
        // For other statuses, just update the status field
        await db.collection('organizations').doc(slug).update({
          status: status,
          updatedAt: new Date().toISOString()
        });
      }

      return { slug, status };
    } catch (error) {
      console.error(`Failed to update organization status: ${slug}`, error);
      throw error;
    }
  }

  async updateOrganization(slug, updates) {
    try {
      if (!slug) {
        throw new Error('Organization slug is required');
      }

      const db = this.centralFirestore;
      
      // Update organization fields in Firestore
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await db.collection('organizations').doc(slug).update(updateData);
      return { slug, ...updates };
    } catch (error) {
      console.error(`Failed to update organization: ${slug}`, error);
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
