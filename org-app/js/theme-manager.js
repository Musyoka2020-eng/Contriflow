// Theme Manager - Handles dark mode toggling and persistence
const ThemeManager = (function() {
    const THEME_KEY = 'app-theme';
    const DARK_THEME = 'dark';
    const LIGHT_THEME = 'light';
    
    // Initialize theme from localStorage or system preference
    function init() {
        const savedTheme = localStorage.getItem(THEME_KEY);
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Use saved theme if exists, otherwise use system preference
        const theme = savedTheme || (prefersDark ? DARK_THEME : LIGHT_THEME);
        
        setTheme(theme);
        setupToggleButton();
    }
    
    // Set theme on the document
    function setTheme(theme) {
        if (theme === DARK_THEME) {
            document.body.setAttribute('data-theme', DARK_THEME);
            localStorage.setItem(THEME_KEY, DARK_THEME);
            updateToggleIcon(DARK_THEME);
        } else {
            document.body.removeAttribute('data-theme');
            localStorage.setItem(THEME_KEY, LIGHT_THEME);
            updateToggleIcon(LIGHT_THEME);
        }
    }
    
    // Get current theme
    function getTheme() {
        return document.body.getAttribute('data-theme') || LIGHT_THEME;
    }
    
    // Toggle between light and dark
    function toggle() {
        const currentTheme = getTheme();
        const newTheme = currentTheme === LIGHT_THEME ? DARK_THEME : LIGHT_THEME;
        setTheme(newTheme);
    }
    
    // Update toggle button icon
    function updateToggleIcon(theme) {
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (theme === DARK_THEME) {
                if (icon) {
                    icon.classList.remove('fa-moon');
                    icon.classList.add('fa-sun');
                }
                toggleBtn.setAttribute('title', 'Switch to light mode');
            } else {
                if (icon) {
                    icon.classList.remove('fa-sun');
                    icon.classList.add('fa-moon');
                }
                toggleBtn.setAttribute('title', 'Switch to dark mode');
            }
        }
    }
    
    // Setup toggle button click handler
    function setupToggleButton() {
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggle);
        }
    }
    
    // Public API
    return {
        init: init,
        setTheme: setTheme,
        getTheme: getTheme,
        toggle: toggle
    };
})();

// Initialize theme when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ThemeManager.init();
    });
} else {
    ThemeManager.init();
}
