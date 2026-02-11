let userauth;
let fdatabase;
let currentUser = null;
let authSection;
let onAuthStateChangedCallback = () => {};

// Initialize authentication module
function initAuth(firebaseAuth, firebaseDatabase, authContainerSelector) {
    return new Promise((resolve) => {
        userauth = firebaseAuth;
        fdatabase = firebaseDatabase;
        authSection = document.querySelector(authContainerSelector);
        
        if (!authSection) {
            console.error('Auth container not found');
            authSection = document.createElement('section');
            authSection.className = 'auth-section';
            document.querySelector('.container').insertBefore(authSection, document.querySelector('main'));
        }
        
        // Set up auth state change listener
        userauth.onAuthStateChanged(async (user) => {
            if (user) {
                // User is signed in
                try {
                    // Check user role from database
                    const userRef = fdatabase.ref(`users/${user.uid}`);
                    const userSnapshot = await userRef.once('value');
                    
                    if (!userSnapshot.exists()) {
                        // First-time user, set as viewer by default
                        await userRef.set({
                            email: user.email,
                            role: 'viewer',
                            createdAt: firebase.database.ServerValue.TIMESTAMP
                        });
                        
                        user.role = 'viewer';
                    } else {
                        user.role = userSnapshot.val().role || 'viewer';
                    }
                    
                    currentUser = user;
                    
                    // Show authenticated UI
                    showAuthenticatedUI(user);
                    
                    // Notify app.js about authentication change
                    onAuthStateChangedCallback(user);
                } catch (error) {
                    console.error('Error setting up user data:', error);
                    logoutUser();
                    showToast('error', 'Authentication Error', 'Failed to load user data. Please try again.');
                }
            } else {
                // User is signed out
                currentUser = null;
                showLoginUI();
                
                // Notify app.js about authentication change
                onAuthStateChangedCallback(null);
            }
            // Resolve the promise when auth state is first determined
            resolve();
        });
    });
}

// Set callback for auth state changes
function setAuthStateChangedCallback(callback) {
    if (typeof callback === 'function') {
        onAuthStateChangedCallback = callback;
    }
}

// Show login UI
function showLoginUI() {
    // Show the home link when not authenticated
    const homeLink = document.querySelector('.home-link');
    if (homeLink) {
        homeLink.style.display = 'flex';
    }

    // Hide the initial loading spinner when showing login UI
    const spinner = document.getElementById('initial-loading-spinner');
    if (spinner) {
        spinner.classList.add('hidden');
        setTimeout(() => {
            if (spinner.parentNode) {
                spinner.remove();
            }
        }, 300);
    }

    if (!authSection) return;
    
    const orgName = window.orgName || 'Contribution Manager';
    const orgInitial = orgName.charAt(0).toUpperCase();
    
    authSection.innerHTML = `
        <div class="auth-container">
            <div class="auth-card">
                <div class="auth-header">
                    <div class="org-logo">${orgInitial}</div>
                    <h1>${sanitizeHTML(orgName)}</h1>
                    <p class="auth-subtitle">Manage your group contributions with ease</p>
                </div>

                <div class="auth-tabs">
                    <button type="button" class="auth-tab active" id="login-tab-btn" data-tab="login">
                        <i class="fas fa-sign-in-alt"></i> Login
                    </button>
                    <button type="button" class="auth-tab" id="signup-tab-btn" data-tab="signup">
                        <i class="fas fa-user-plus"></i> Create Account
                    </button>
                </div>

                <form id="login-form" class="auth-form active-form">
                    <div class="form-group">
                        <label for="login-email">Email Address</label>
                        <div class="input-wrapper">
                            <i class="fas fa-envelope"></i>
                            <input type="email" id="login-email" placeholder="your@email.com" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="login-password">Password</label>
                        <div class="input-wrapper">
                            <i class="fas fa-lock"></i>
                            <input type="password" id="login-password" placeholder="Enter your password" required autocomplete="current-password">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">
                        <i class="fas fa-sign-in-alt"></i> Login
                    </button>
                </form>
                
                <form id="signup-form" class="auth-form">
                    <div class="form-group">
                        <label for="signup-email">Email Address</label>
                        <div class="input-wrapper">
                            <i class="fas fa-envelope"></i>
                            <input type="email" id="signup-email" placeholder="your@email.com" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="signup-password">Password</label>
                        <div class="input-wrapper">
                            <i class="fas fa-lock"></i>
                            <input type="password" id="signup-password" placeholder="Create a password (min. 6 characters)" required autocomplete="new-password">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="signup-confirm">Confirm Password</label>
                        <div class="input-wrapper">
                            <i class="fas fa-lock"></i>
                            <input type="password" id="signup-confirm" placeholder="Confirm your password" required autocomplete="new-password">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">
                        <i class="fas fa-user-plus"></i> Create Account
                    </button>
                </form>
            </div>
        </div>
    `;
    
    // Tab switching
    document.getElementById('login-tab-btn').addEventListener('click', () => {
        document.getElementById('login-form').classList.add('active-form');
        document.getElementById('signup-form').classList.remove('active-form');
        document.getElementById('login-tab-btn').classList.add('active');
        document.getElementById('signup-tab-btn').classList.remove('active');
    });
    
    document.getElementById('signup-tab-btn').addEventListener('click', () => {
        document.getElementById('signup-form').classList.add('active-form');
        document.getElementById('login-form').classList.remove('active-form');
        document.getElementById('signup-tab-btn').classList.add('active');
        document.getElementById('login-tab-btn').classList.remove('active');
    });
    
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
}

// Show authenticated UI
function showAuthenticatedUI(user) {
    // Hide the home link when user is authenticated
    const homeLink = document.querySelector('.home-link');
    if (homeLink) {
        homeLink.style.display = 'none';
    }

    // Hide the initial loading spinner when authenticated user is shown
    const spinner = document.getElementById('initial-loading-spinner');
    if (spinner) {
        spinner.classList.add('hidden');
        setTimeout(() => {
            if (spinner.parentNode) {
                spinner.remove();
            }
        }, 300);
    }

    if (!authSection) return;

    let adminButton = '';
    if (user.role === 'admin') {
        adminButton = '<button id="admin-dashboard-btn" class="btn btn-small"><i class="fas fa-user-shield"></i> Admin</button>';
    }
    
    authSection.innerHTML = `
        <div class="user-info">
            <div class="user-details">
                <i class="fas fa-user-circle"></i>
                <span class="user-email">${sanitizeHTML(user.email)}</span>
                <span class="user-role-badge">${user.role}</span>
            </div>
            <div class="user-actions">
                ${adminButton}
                <button id="logout-btn" class="btn btn-small"><i class="fas fa-sign-out-alt"></i> Logout</button>
            </div>
        </div>
    `;
    
    document.getElementById('logout-btn').addEventListener('click', logoutUser);
    
    if (user.role === 'admin') {
        document.getElementById('admin-dashboard-btn').addEventListener('click', showAdminDashboard);
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showToast('error', 'Login Error', 'Please enter both email and password');
        return;
    }
    
    try {
        const loadingToast = Swal.fire({
            title: 'Logging In...',
            didOpen: () => {
                Swal.showLoading();
            },
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });

        await userauth.signInWithEmailAndPassword(email, password);
        Swal.close();
    } catch (error) {
        console.error('Login error:', error);
        showToast('error', 'Login Failed', getAuthErrorMessage(error));
    }
}

// Handle signup
async function handleSignup(e) {
    e.preventDefault();
    
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    
    if (!email || !password || !confirm) {
        showToast('error', 'Registration Error', 'Please fill in all fields');
        return;
    }
    
    if (password !== confirm) {
        showToast('error', 'Password Mismatch', 'Passwords do not match');
        return;
    }
    
    if (password.length < 6) {
        showToast('error', 'Password Too Short', 'Password must be at least 6 characters');
        return;
    }
    
    try {
        const loadingToast = Swal.fire({
            title: 'Creating Account...',
            didOpen: () => {
                Swal.showLoading();
            },
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
        
        await userauth.createUserWithEmailAndPassword(email, password);
        Swal.close();
    } catch (error) {
        console.error('Signup error:', error);
        showToast('error', 'Registration Failed', getAuthErrorMessage(error));
    }
}

// Log out the current user
function logoutUser() {
    userauth.signOut().catch(error => {
        console.error('Logout error:', error);
    });
}

// Get readable auth error messages
function getAuthErrorMessage(error) {
    switch (error.code) {
        case 'auth/user-not-found':
            return 'No account exists with this email';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/email-already-in-use':
            return 'This email is already registered';
        case 'auth/weak-password':
            return 'Password is too weak';
        case 'auth/invalid-email':
            return 'Invalid email format';
        default:
            return `Error: ${error.message}`;
    }
}

// Show toast notification
function showToast(icon, title, text) {
    Swal.fire({
        icon: icon,
        title: title,
        text: text,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
    });
}

// Show admin dashboard
function showAdminDashboard() {
    // Navigate to admin dashboard page
    // The admin-dashboard.js will verify admin role on that page
    window.location.href = 'admin-dashboard.html';
}

// Load user list for admin dashboard
async function loadUserList() {
    try {
        const usersRef = fdatabase.ref('users');
        const usersSnapshot = await usersRef.once('value');
        const users = usersSnapshot.val();
        
        if (!users) {
            document.getElementById('user-list').innerHTML = '<p>No users found</p>';
            return;
        }
        
        let userTable = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (const uid in users) {
            if (!Object.prototype.hasOwnProperty.call(users, uid)) continue;
            
            const user = users[uid];
            userTable += `
                <tr>
                    <td>${sanitizeHTML(user.email)}</td>
                    <td>
                        <select class="role-select" data-uid="${uid}">
                            <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                            <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn btn-small save-role" data-uid="${uid}">Save</button>
                    </td>
                </tr>
            `;
        }
        
        userTable += `
                </tbody>
            </table>
        `;
        
        document.getElementById('user-list').innerHTML = userTable;
        
        // Add event listeners
        for(const btn of document.querySelectorAll('.save-role')) {
            btn.addEventListener('click', updateUserRole);
        }
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('user-list').innerHTML = '<p>Error loading users</p>';
    }
}

// Update user role
async function updateUserRole(e) {
    const uid = e.target.dataset.uid;
    const roleSelect = document.querySelector(`.role-select[data-uid="${uid}"]`);
    const newRole = roleSelect.value;
    
    try {
        await fdatabase.ref(`users/${uid}/role`).set(newRole);
        showToast('success', 'Role Updated', 'User role has been updated successfully');
    } catch (error) {
        console.error('Error updating role:', error);
        showToast('error', 'Update Failed', 'Failed to update user role');
    }
}

// Check if user is authenticated
function isUserAuthenticated() {
    return currentUser !== null;
}

// Get current user
function getCurrentUser() {
    return currentUser;
}

// Get user role
function getUserRole() {
    return currentUser?.role || 'viewer';
}

// Sanitize HTML to prevent XSS
function sanitizeHTML(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export functions for use in app.js
window.AuthModule = {
    initAuth,
    setAuthStateChangedCallback,
    isUserAuthenticated,
    getCurrentUser,
    getUserRole,
    logoutUser,
    sanitizeHTML
};
