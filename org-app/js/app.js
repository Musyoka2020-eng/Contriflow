// Main Application Coordinator
// Minimal orchestration layer that wires modules together

document.addEventListener('DOMContentLoaded', async () => {
    // Verify org context is available (should already be initialized by inline script before firebase-manager.js)
    if (!window.orgFirebaseConfig || !window.orgSlug) {
        // Fallback: try to read from sessionStorage if inline script didn't run for some reason
        const orgContextStr = sessionStorage.getItem('orgContext');
        if (orgContextStr) {
            const orgContext = JSON.parse(orgContextStr);
            window.orgFirebaseConfig = orgContext.firebaseConfig;
            window.orgSlug = orgContext.slug;
            window.orgName = orgContext.name;
            // Organization context loaded from fallback
        } else {
            // No org context available - user accessed org-app directly without proper setup
            console.error('No organization context found - redirecting to organization selection');
            window.location.href = '/pages/error-pages/no-organization.html';
            return;
        }
    }

    // Function to hide the initial loading spinner
    function hideLoadingSpinner() {
        const spinner = document.getElementById('initial-loading-spinner');
        if (spinner) {
            spinner.classList.add('hidden');
            // Remove from DOM after fade-out animation
            setTimeout(() => {
                spinner.remove();
            }, 300);
        }
    }

    // Application state
    const appState = {
        contributionsData: {},
        blacklistData: { blacklistedMembers: [] },
        budgetData: { expenses: {} },
        campaignsData: {},
        currentYear: moment().format('YYYY'),
        currentMonth: moment().format('MMMM'),
        currentView: Utils.getSavedView(), // Restore last viewed tab
        phoneNumber: Utils.getPhoneNumber(),
        appInitialized: false,
        saveDataCallback: null,
        updateDisplayCallback: null
    };

    // Get Firebase references
    const database = FirebaseManager.getDatabase();
    const auth = FirebaseManager.getAuth();

    // Initialize DOM Manager
    DOMManager.init();
    const dom = DOMManager.getAll();

    // Data operations
    async function loadData() {
        const startTime = performance.now();
        try {
            const data = await FirebaseManager.loadData();
            
            appState.contributionsData = data.contributionsData;
            appState.blacklistData = data.blacklistData;
            appState.budgetData = data.budgetData || { expenses: {} };
            appState.campaignsData = data.campaignsData || {};
            FirebaseManager.setLastSyncTime(data.lastSyncTime);
            Utils.updateSyncStatus(data.lastSyncTime);
            
            // Initialize to valid month and year based on loaded data
            initializeCurrentMonthAndYear();
            // Hide the loading spinner after data is loaded
            hideLoadingSpinner();
            
            const loadTime = (performance.now() - startTime).toFixed(2);
            // Data loaded successfully
        } catch (error) {
            console.error('Error loading data:', error);
            hideLoadingSpinner();
            Swal.fire({
                icon: 'error',
                title: 'Failed to Load Data',
                text: 'There was an error loading your data. Please refresh the page.',
                confirmButtonText: 'Refresh',
            }).then(() => {
                window.location.reload();
            });
        }
    }

    let saveTimeout = null;
    async function saveData(showNotification = false) {
        if (saveTimeout) clearTimeout(saveTimeout);
        
        saveTimeout = setTimeout(async () => {
            const startTime = performance.now();
            try {
                const success = await FirebaseManager.saveData(
                    appState.contributionsData,
                    appState.blacklistData,
                    appState.budgetData,
                    appState.campaignsData,
                    showNotification
                );
                if (success) {
                    Utils.updateSyncStatus(FirebaseManager.getLastSyncTime());
                    const saveTime = (performance.now() - startTime).toFixed(2);
                    // Data saved successfully - refresh UI to ensure all views are in sync
                    try {
                        updateDisplay();
                    } catch (err) {
                        console.error('Error refreshing display after save:', err);
                    }
                }
            } catch (error) {
                console.error('Error saving data:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Save Failed',
                    text: 'Failed to save changes. Please try syncing manually.',
                    toast: true,
                    position: 'top-end',
                    timer: 3000,
                    showConfirmButton: false
                });
            }
        }, 1000);
    }

    async function syncData() {
        const startTime = performance.now();
        try {
            // Re-load all data from Firebase
            const data = await FirebaseManager.loadData();
            appState.contributionsData = data.contributionsData;
            appState.blacklistData = data.blacklistData;
            appState.budgetData = data.budgetData || { expenses: {} };
            appState.campaignsData = data.campaignsData || {};
            
            // Refresh year/month selectors with potentially new data
            Utils.populateYearSelect(dom.yearSelect, appState.currentYear, appState.contributionsData);
            Utils.populateMonthSelect(dom.monthSelect, appState.currentMonth, appState.contributionsData, appState.currentYear);
            
            if (data.lastSyncTime) {
                FirebaseManager.setLastSyncTime(data.lastSyncTime);
                Utils.updateSyncStatus(data.lastSyncTime);
                const syncTime = (performance.now() - startTime).toFixed(2);
                // Data synced successfully
            }
            
            // Re-initialize modules and refresh display
            UIRenderer.init(appState);
            ViewManager.init(appState);
            updateDisplay();
        } catch (error) {
            console.error('Error syncing data:', error);
            Swal.fire({
                icon: 'error',
                title: 'Sync Failed',
                text: 'Failed to synchronize data with the server. Please check your connection.',
            });
        }
    }

    // Update display function
    function updateDisplay() {
        try {
            ViewManager.updateDisplay().catch(error => {
                console.error('Error updating display:', error);
            });
        } catch (error) {
            console.error('Error updating display:', error);
            // Silent fail for display updates to avoid interrupting user flow
        }
    }

    // Setup callbacks for event handlers
    appState.saveDataCallback = saveData;
    appState.updateDisplayCallback = updateDisplay;

    // Initialize current month and year based on available data
    function initializeCurrentMonthAndYear() {
        // Always use the actual current month/year, not the most recent month with data
        // This allows checkAndCreateCurrentMonth() to work properly
        appState.currentYear = moment().format('YYYY');
        appState.currentMonth = moment().format('MMMM');
    }

    // Event handler functions
    const eventHandlers = {
        togglePaymentStatus: EventHandlers.togglePaymentStatus.bind(EventHandlers),
        removeContribution: EventHandlers.removeContribution.bind(EventHandlers),
        handleBlacklistMember: EventHandlers.handleBlacklistMember.bind(EventHandlers),
        editContribution: EventHandlers.editContribution.bind(EventHandlers),
        removeFromBlacklist: EventHandlers.removeFromBlacklist.bind(EventHandlers)
    };

    appState.eventHandlers = eventHandlers;

    // Initialize modules with state
    EventHandlers.init(appState);
    ViewManager.init(appState);
    UIRenderer.init(appState);

    // Event listener setup
    function setupEventListeners() {
        // Initialize Modal Manager and Expected Members Manager
        ModalManager.init();
        ExpectedMembersManager.init();

        // Tab navigation buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                appState.currentView = view;
                Utils.saveCurrentView(view); // Save view preference
                ViewManager.handleViewChange(view);
                
                // Setup budget event handlers if viewing budget tab
                if (view === 'budget') {
                    setTimeout(() => {
                        EventHandlers.setupBudgetEventHandlers();
                    }, 100);
                }

                // Setup special giving event handlers if viewing special-giving tab
                if (view === 'special-giving') {
                    setTimeout(() => {
                        EventHandlers.setupSpecialGivingEventHandlers();
                    }, 100);
                }
            });
        });

        // Period selectors
        if (dom.yearSelect) {
            dom.yearSelect.addEventListener('change', () => {
                const newYear = dom.yearSelect.value; // Keep as string since DB keys are strings
                appState.currentYear = newYear;
                
                // Refresh month selector for the new year
                // First get the available months for this year
                const yearData = appState.contributionsData[newYear] || {};
                const allMonths = moment.months();
                const monthsInYear = allMonths.filter(month => yearData[month]);
                
                // If no months have data in this year, use current month; otherwise use most recent month for this year
                let newMonth = appState.currentMonth;
                if (monthsInYear.length > 0) {
                    if (!monthsInYear.includes(newMonth)) {
                        // Get the most recent month (highest index)
                        const monthsWithIndices = monthsInYear.map(month => ({
                            month,
                            index: allMonths.indexOf(month)
                        }));
                        monthsWithIndices.sort((a, b) => b.index - a.index);
                        newMonth = monthsWithIndices[0].month;
                    }
                }
                
                appState.currentMonth = newMonth;
                // Refresh the month selector to show months for this year
                Utils.populateMonthSelect(dom.monthSelect, newMonth, appState.contributionsData, newYear);
                
                ViewManager.handlePeriodChange(newYear, newMonth);
                updateDisplay();
            });
        }

        if (dom.monthSelect) {
            dom.monthSelect.addEventListener('change', () => {
                const newYear = dom.yearSelect.value;
                const newMonth = dom.monthSelect.value;
                appState.currentYear = newYear;
                appState.currentMonth = newMonth;
                ViewManager.handlePeriodChange(newYear, newMonth);
                updateDisplay();
            });
        }

        // Legacy dropdown support (if exists)
        if (dom.viewTypeSelect) {
            dom.viewTypeSelect.addEventListener('change', () => {
                appState.currentView = dom.viewTypeSelect.value;
                ViewManager.handleViewChange(appState.currentView);
            });
        }

        // Create month button
        if (dom.createMonthBtn) {
            dom.createMonthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const monthExists = !!appState.contributionsData[appState.currentYear]?.[appState.currentMonth];

            if (monthExists) {
                Swal.fire({
                    icon: 'question',
                    title: 'Month Already Exists',
                    text: `${appState.currentMonth} ${appState.currentYear} already exists. What would you like to do?`,
                    showDenyButton: true,
                    showCancelButton: true,
                    confirmButtonText: 'Overwrite completely',
                    denyButtonText: 'Add new members only',
                    cancelButtonText: 'Cancel'
                }).then((result) => {
                    if (result.isConfirmed || result.isDenied) {
                        const previousMonthData = ContributionsManager.findPreviousMonthData(
                            appState.contributionsData,
                            appState.currentYear,
                            appState.currentMonth
                        );
                        const createResult = ViewManager.handleCreateMonth(
                            previousMonthData,
                            monthExists,
                            result.isConfirmed
                        );
                        
                        saveData(true);
                        updateDisplay();

                        if (result.isDenied) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Month Updated',
                                text: `Added ${createResult.newMembersAdded} new member${createResult.newMembersAdded !== 1 ? 's' : ''} to ${appState.currentMonth} ${appState.currentYear}.`
                            });
                        } else {
                            Swal.fire({
                                icon: 'success',
                                title: 'Month Overwritten',
                                text: `${appState.currentMonth} ${appState.currentYear} has been overwritten successfully.`
                            });
                        }
                    }
                });
            } else {
                const previousMonthData = ContributionsManager.findPreviousMonthData(
                    appState.contributionsData,
                    appState.currentYear,
                    appState.currentMonth
                );
                ViewManager.handleCreateMonth(previousMonthData, false, true);
                saveData(true);
                updateDisplay();
                
                Swal.fire({
                    icon: 'success',
                    title: 'Month Created',
                    text: `${appState.currentMonth} ${appState.currentYear} has been created successfully.`
                });
            }
            });
        }

        // Contribution form
        if (dom.contributionForm) {
            dom.contributionForm.addEventListener('submit', EventHandlers.handleFormSubmit.bind(EventHandlers));
        }

        // Blacklist
        if (dom.addToBlacklistBtn) {
            dom.addToBlacklistBtn.addEventListener('click', EventHandlers.addToBlacklist.bind(EventHandlers));
        }

        // Phone and sharing
        if (dom.savePhoneBtn) {
            dom.savePhoneBtn.addEventListener('click', EventHandlers.savePhoneNumber.bind(EventHandlers));
        }
        if (dom.sendWhatsAppBtn) {
            dom.sendWhatsAppBtn.addEventListener('click', () => {
                EventHandlers.shareReport(appState.currentView);
            });
        }

        // Reports
        const reportsDom = DOMManager.getReportsViewElements();
        if (reportsDom.reportTypeSelect) {
            reportsDom.reportTypeSelect.addEventListener('change', () => {
                ReportsManager.handleReportTypeChange(reportsDom.reportTypeSelect, reportsDom.memberSelectGroup, reportsDom.statusFilterGroup);
            });
        }
        if (reportsDom.generateReportBtn) {
            reportsDom.generateReportBtn.addEventListener('click', () => {
                ViewManager.generateReport();
            });
        }
        if (reportsDom.exportReportText) {
            reportsDom.exportReportText.addEventListener('click', () => {
                ReportsManager.exportReportAsText();
            });
        }
        if (reportsDom.printReport) {
            reportsDom.printReport.addEventListener('click', () => {
                ReportsManager.printReportContent(reportsDom.reportContent);
            });
        }
        if (reportsDom.shareReportWhatsapp) {
            reportsDom.shareReportWhatsapp.addEventListener('click', () => {
                ReportsManager.shareReportViaWhatsapp(appState.phoneNumber);
            });
        }

        // Sync button
        if (dom.exportDataBtn) {
            dom.exportDataBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Sync Data';
            dom.exportDataBtn.addEventListener('click', syncData);
        }
    }

    // Initialize application
    async function init() {
        // Set footer year
        if (dom.currentYearFooter) {
            dom.currentYearFooter.textContent = moment().format('YYYY');
        }
        
        // Set phone number if exists
        if (appState.phoneNumber && dom.phoneNumberInput) {
            dom.phoneNumberInput.value = appState.phoneNumber;
        }

        // Load data from Firebase
        await loadData();

        // Re-initialize modules with updated appState after loading data
        // (loadData replaces appState.contributionsData, so we need to update module references)
        UIRenderer.init(appState);
        ViewManager.init(appState);
        EventHandlers.init(appState);

        // Initialize budget manager for admin users and special giving manager for all users
        const userRole = AuthModule.getUserRole();
        const currentUser = AuthModule.getCurrentUser();
        
        // Initialize managers (they now work with appState data)
        if (userRole === 'admin' && currentUser) {
            await BudgetManager.init(currentUser.uid);
        }

        // Initialize special giving manager for all authenticated users
        if (currentUser && currentUser.uid) {
            await SpecialGivingManager.init(currentUser.uid);
        } else {
            console.warn('Cannot initialize SpecialGivingManager - no user uid available', currentUser);
        }

        // Populate selectors ONLY if there's actual data
        if (UIRenderer.hasAnyYears(appState.contributionsData)) {
            Utils.populateYearSelect(dom.yearSelect, appState.currentYear, appState.contributionsData);
            Utils.populateMonthSelect(dom.monthSelect, appState.currentMonth, appState.contributionsData, appState.currentYear);
        } else {
            // No data - clear selectors and let empty state show
            dom.yearSelect.innerHTML = '';
            dom.monthSelect.innerHTML = '';
        }

        // Check and create current month if needed (only if data exists)
        const monthCreated = ViewManager.checkAndCreateCurrentMonth();
        if (monthCreated) {
            saveData();
        }

        // Initialize reports filters
        const reportsDom = DOMManager.getReportsViewElements();
        ReportsManager.populateReportFilters(
            reportsDom.reportStartMonth,
            reportsDom.reportEndMonth,
            reportsDom.reportStartYear,
            reportsDom.reportEndYear,
            appState.currentMonth,
            appState.currentYear,
            appState.contributionsData
        );
        
        // Initialize report type visibility (show/hide member and status filters)
        ReportsManager.handleReportTypeChange(
            reportsDom.reportTypeSelect, 
            reportsDom.memberSelectGroup, 
            reportsDom.statusFilterGroup
        );
        
        // Initialize member select dropdown
        ReportsManager.updateMemberSelect(appState.contributionsData, reportsDom.reportMemberSelect);

        // Apply role restrictions
        UIRenderer.applyRoleRestrictions(AuthModule.getUserRole());
        Utils.updateSyncStatus(FirebaseManager.getLastSyncTime());

        // Setup event listeners
        setupEventListeners();

        // Activate the saved tab UI and show the view content
        ViewManager.updateTabUI(appState.currentView);
        UIRenderer.showView(appState.currentView);

        // Update display for the current view
        updateDisplay();
    }

    // Auth state handler
    function handleAuthStateChanged(user) {
        if (user) {
            dom.mainContainer.style.display = 'block';
            UIRenderer.applyRoleRestrictions(user.role);

            if (!appState.appInitialized) {
                init();
                appState.appInitialized = true;
            } else {
                updateDisplay();
            }
        } else {
            dom.mainContainer.style.display = 'none';
            appState.appInitialized = false;
        }
    }

    // Initialize auth module
    try {
        // Set the callback BEFORE initializing auth so we catch the initial state
        AuthModule.setAuthStateChangedCallback(handleAuthStateChanged);
        await AuthModule.initAuth(auth, database, '.auth-section');
    } catch (error) {
        console.error('Error initializing auth module:', error);
    }
});
