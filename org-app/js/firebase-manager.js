// Firebase Manager Module
// Handles all Firebase initialization and data operations

// Show toast notification
function showToast(icon, title, text) {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        toast: true,
        position: 'top-end',
        timer: 3000
    });
}

const FirebaseManager = (function() {
    // Get Firebase configuration from injected organization context
    // orgFirebaseConfig must be provided by the organization loader
    let database;
    let auth;
    
    if (typeof window !== 'undefined' && window.orgFirebaseConfig) {
        // Use injected organization-specific config
        try {
            const appName = `org_${window.orgSlug}`;
            
            // Try to get existing app instance
            const existingApp = firebase.app(appName);
            database = firebase.database(existingApp);
            auth = firebase.auth(existingApp);
            // Using existing Firebase app instance
        } catch (error) {
            // App doesn't exist, initialize it
            const firebaseConfig = window.orgFirebaseConfig;
            const firebaseApp = firebase.initializeApp(firebaseConfig, `org_${window.orgSlug}`);
            database = firebase.database(firebaseApp);
            auth = firebase.auth(firebaseApp);
            // Firebase app initialized for organization
        }
    } else {
        // Organization config not provided - this should only happen if accessed directly without proper flow
        throw new Error('Organization Firebase configuration not provided. Access the app through the proper organization loader.');
    }

    let lastSyncTime = null;

    // Public API
    return {
        getDatabase: () => database,
        getAuth: () => auth,
        getLastSyncTime: () => lastSyncTime,
        setLastSyncTime: (time) => { lastSyncTime = time; },

        // Load data from Firebase (all data types in single operation)
        async loadData() {
            try {
                Swal.fire({
                    title: 'Loading data...',
                    didOpen: () => { Swal.showLoading(); },
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false
                });

                if (!AuthModule.isUserAuthenticated()) {
                    throw new Error('Authentication required');
                }

                const currentUserUID = AuthModule.getCurrentUser()?.uid;

                const [contributionsSnapshot, blacklistSnapshot, lastSyncSnapshot, budgetsSnapshot, campaignsSnapshot] = await Promise.all([
                    database.ref('contributionsData').once('value'),
                    database.ref('blacklistData').once('value'),
                    database.ref('meta/lastSync').once('value'),
                    currentUserUID ? database.ref(`budgets/${currentUserUID}`).once('value') : Promise.resolve(null),
                    database.ref('specialGiving').once('value')
                ]);

                const contributionsData = contributionsSnapshot.val() || {};
                const blacklistData = blacklistSnapshot.val() || { blacklistedMembers: [] };
                const budgetData = budgetsSnapshot ? (budgetsSnapshot.val() || { expenses: {} }) : { expenses: {} };
                const campaignsData = campaignsSnapshot.val() || {};
                lastSyncTime = lastSyncSnapshot.val() || null;

                // CRITICAL: Clear localStorage cache completely before setting new data
                // This ensures old stale data doesn't persist when Firebase is empty
                localStorage.removeItem('contributionsData');
                localStorage.removeItem('blacklistData');
                localStorage.removeItem('budgetData');
                localStorage.removeItem('campaignsData');
                localStorage.removeItem('lastSyncTime');
                localStorage.removeItem('lastCache');
                localStorage.removeItem('lastBackup');

                // Now populate localStorage with fresh Firebase data
                localStorage.setItem('contributionsData', JSON.stringify(contributionsData));
                localStorage.setItem('blacklistData', JSON.stringify(blacklistData));
                localStorage.setItem('budgetData', JSON.stringify(budgetData));
                localStorage.setItem('campaignsData', JSON.stringify(campaignsData));
                localStorage.setItem('lastSyncTime', lastSyncTime);
                const cachePayload = {
                    contributionsData,
                    blacklistData,
                    budgetData,
                    campaignsData,
                    timestamp: new Date().toISOString()
                };
                localStorage.setItem('lastCache', JSON.stringify(cachePayload));

                Swal.close();
                return { contributionsData, blacklistData, budgetData, campaignsData, lastSyncTime };
            } catch (error) {
                console.error('Error loading data:', error);
                showToast('error', 'Data Loading Error', error.message || 'Could not load contribution data.');
                return {
                    contributionsData: {},
                    blacklistData: { blacklistedMembers: [] },
                    budgetData: { expenses: {} },
                    campaignsData: {},
                    lastSyncTime: null
                };
            }
        },

        // Save data to Firebase with debounce (supports contributions, blacklist, budget, and campaigns)
        async saveData(contributionsData, blacklistData, budgetData = null, campaignsData = null, showNotification = false) {
            try {
                if (!AuthModule.isUserAuthenticated()) {
                    throw new Error('Authentication required');
                }

                const userRole = AuthModule.getUserRole();
                if (userRole === 'viewer') {
                    throw new Error('You do not have permission to save changes');
                }

                const currentUserUID = AuthModule.getCurrentUser()?.uid;

                // Save to localStorage as BACKUP (in case of Firebase failure)
                const backupPayload = {
                    contributionsData,
                    blacklistData,
                    budgetData,
                    campaignsData,
                    timestamp: new Date().toISOString()
                };
                localStorage.setItem('contributionsData', JSON.stringify(contributionsData || {}));
                localStorage.setItem('blacklistData', JSON.stringify(blacklistData));
                localStorage.setItem('budgetData', JSON.stringify(budgetData || {}));
                localStorage.setItem('campaignsData', JSON.stringify(campaignsData || {}));
                localStorage.setItem('lastBackup', JSON.stringify(backupPayload));

                // Save contributions to Firebase (only if not empty to avoid deleting data)
                if (contributionsData && Object.keys(contributionsData).length > 0) {
                    // Count total contributions being saved
                    let totalContributions = 0;
                    for (const year in contributionsData) {
                        for (const month in contributionsData[year]) {
                            if (contributionsData[year][month].contributions) {
                                totalContributions += contributionsData[year][month].contributions.length;
                            }
                        }
                    }
                    await database.ref('contributionsData').set(this.validateContributionsData(contributionsData));
                }

                // Save blacklist (independent of contributions)
                if (blacklistData) {
                    if (userRole === 'admin') {
                        await database.ref('blacklistData').set(this.validateBlacklistData(blacklistData));
                    }
                }

                // Save budget data if provided (independent of contributions)
                if (budgetData && currentUserUID) {
                    await database.ref(`budgets/${currentUserUID}`).set(budgetData);
                }

                // Save campaigns data if provided (independent of contributions)
                if (campaignsData) {
                    await database.ref('specialGiving').set(campaignsData);
                }

                lastSyncTime = new Date().getTime();
                await database.ref('meta/lastSync').set(lastSyncTime);
                localStorage.setItem('lastSyncTime', lastSyncTime);

                if (showNotification) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Saved!',
                        text: 'Your changes have been saved to Firebase.',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                }

                return true;
            } catch (error) {
                console.error('Error saving data:', error);
                showToast('error', 'Save Error', error.message || 'Failed to save data.');
                return false;
            }
        },

        // Sync data with Firebase
        async syncData(contributionsData, blacklistData) {
            try {
                // CRITICAL SAFETY CHECKS - Prevent accidental data deletion
                if (!contributionsData || Object.keys(contributionsData).length === 0) {
                    console.error('Sync blocked: Empty contributions data detected. This would delete all data.');
                    throw new Error('Cannot sync empty contributions data - this would delete all data');
                }

                // Count total contributions being synced
                let totalContributions = 0;
                for (const year in contributionsData) {
                    for (const month in contributionsData[year]) {
                        if (contributionsData[year][month].contributions) {
                            totalContributions += contributionsData[year][month].contributions.length;
                        }
                    }
                }

                Swal.fire({
                    title: 'Syncing data...',
                    didOpen: () => { Swal.showLoading(); },
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false
                });

                // Save to localStorage BEFORE Firebase (safety backup)
                localStorage.setItem('contributionsData', JSON.stringify(contributionsData));
                localStorage.setItem('blacklistData', JSON.stringify(blacklistData));

                await database.ref('contributionsData').set(contributionsData);
                await database.ref('blacklistData').set(blacklistData);

                lastSyncTime = new Date().getTime();
                await database.ref('meta/lastSync').set(lastSyncTime);

                showToast('success', 'Sync Complete', 'Your data has been synchronized with Firebase.');

                return lastSyncTime;
            } catch (error) {
                console.error('Error syncing data:', error);
                showToast('error', 'Sync Error', 'Failed to sync data with Firebase.');
                return null;
            }
        },

        // Validate contributions data
        validateContributionsData(data) {
            const validData = JSON.parse(JSON.stringify(data));

            for (const year in validData) {
                if (!validData.hasOwnProperty(year)) continue;

                if (!/^\d{4}$/.test(year)) {
                    delete validData[year];
                    continue;
                }

                for (const month in validData[year]) {
                    if (!validData[year].hasOwnProperty(month)) continue;

                    const validMonths = moment.months();
                    if (!validMonths.includes(month)) {
                        delete validData[year][month];
                        continue;
                    }

                    if (!Array.isArray(validData[year][month].contributions)) {
                        validData[year][month].contributions = [];
                    }

                    validData[year][month].contributions = validData[year][month].contributions.filter(c => {
                        return c && typeof c.name === 'string' &&
                            typeof c.amount === 'number' &&
                            typeof c.paid === 'boolean';
                    });

                    let total = 0;
                    for (const contribution of validData[year][month].contributions) {
                        total += contribution.amount;
                    }
                    validData[year][month].total = total;
                }
            }

            return validData;
        },

        // Validate blacklist data
        validateBlacklistData(data) {
            if (!data || !Array.isArray(data.blacklistedMembers)) {
                return { blacklistedMembers: [] };
            }

            const validMembers = data.blacklistedMembers.filter(name =>
                typeof name === 'string' && name.trim().length > 0
            );

            return { blacklistedMembers: validMembers };
        }
    };
})();
