/**
 * DEPRECATED: Organization Loader Service
 * 
 * This service has been merged into OrgManager.
 * Use OrgManager.loadOrganization(slug) instead, which now handles:
 * - Loading org from Firestore
 * - Initializing org's Firebase app
 * - Registering with FirebaseService
 * 
 * Kept for reference only. Can be safely removed.
 * 
 * Migration:
 *   OLD: const org = await orgLoader.loadOrganizationFromSlug('slug');
 *   NEW: const org = await orgManager.loadOrganization('slug');
 */

// DEPRECATED - See OrgManager instead
class OrgLoader {
  constructor() {
    this.loadedInstances = {};
    this.orgManager = OrgManager.getInstance();
  }

  async loadOrganizationFromSlug(slug, centralDatabase) {
    try {
      const org = await this.orgManager.loadOrganization(slug);

      // All organizations have their own Firebase project
      await this.initializeOrganizationFirebase(org);

      return org;
    } catch (error) {
      throw error;
    }
  }

  async initializeOrganizationFirebase(org) {
    try {
      if (!org.firebaseConfig) {
        throw new Error(`No Firebase config found for organization: ${org.slug}`);
      }

      if (this.loadedInstances[org.slug]) {
        const instance = this.loadedInstances[org.slug];
        this.orgManager.setOrgFirebaseApp(instance.app);
        this.orgManager.setOrgDatabase(instance.database);
        return;
      }

      const instanceName = `org_${org.slug}`;
      let firebaseApp;

      try {
        firebaseApp = firebase.app(instanceName);
      } catch (error) {
        firebaseApp = firebase.initializeApp(org.firebaseConfig, instanceName);
      }

      const database = firebase.database(firebaseApp);

      this.loadedInstances[org.slug] = {
        app: firebaseApp,
        database: database,
        auth: firebase.auth(firebaseApp)
      };

      this.orgManager.setOrgFirebaseApp(firebaseApp);
      this.orgManager.setOrgDatabase(database);
    } catch (error) {
      throw error;
    }
  }

  async disconnectFromOrg(slug) {
    try {
      if (this.loadedInstances[slug]) {
        try {
          await firebase.app(`org_${slug}`).delete();
          delete this.loadedInstances[slug];
        } catch (error) {
          // Silently ignore cleanup failures
        }
      }

      this.orgManager.clearCurrentOrg();
    } catch (error) {
      throw error;
    }
  }

  static getInstance() {
    if (!OrgLoader.instance) {
      OrgLoader.instance = new OrgLoader();
    }
    return OrgLoader.instance;
  }
}

const orgLoader = OrgLoader.getInstance();
