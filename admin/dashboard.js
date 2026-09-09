import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Exact Firebase Configuration requested
const firebaseConfig = { 
    apiKey: "AIzaSyBEZA5iQBxOUJaKvFMtpVi6w-jMATNESoA", 
    authDomain: "gadget-item.firebaseapp.com", 
    projectId: "gadget-item", 
    storageBucket: "gadget-item.firebasestorage.app", 
    messagingSenderId: "1048854789116", 
    appId: "1:1048854789116:web:91c20aa6dd633815be5079", 
    measurementId: "G-2YMX097PSJ" 
};

// Configured Owner Email
const OWNER_EMAIL = "nazrulislam887441234@gmail.com";

// Initialize Firebase App, Auth & Firestore
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    console.error("Firebase initialization failed:", error);
}

/**
 * Show a professional toast notification message
 */
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    let iconSvg = '';
    if (type === 'success') {
        iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
        iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
        iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    }

    toast.innerHTML = `${iconSvg}<span class="toast-message">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "fadeOut 0.3s ease-out forwards";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Redirect unauthorized users immediately to login
 */
function redirectToLogin() {
    window.location.replace("/login.html");
}

/**
 * Render user role badge dynamically with SVG icon
 */
function renderRoleBadge(role) {
    const headerContainer = document.getElementById("header-role-badge-container");
    if (!headerContainer) return;

    if (role === "Owner") {
        headerContainer.innerHTML = `
            <span class="role-badge owner">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                Owner
            </span>
        `;
    } else {
        headerContainer.innerHTML = `
            <span class="role-badge admin">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Admin
            </span>
        `;
    }
}

/**
 * Render dashboard cards depending on user role
 */
function renderDashboardCards(role) {
    const adminsCard = document.getElementById("admins-card-item");
    const adminsSidebarLink = document.getElementById("admins-sidebar-link");
    const moduleCountBadge = document.getElementById("module-count-badge");

    if (role === "Owner") {
        if (adminsCard) adminsCard.classList.remove("hidden");
        if (adminsSidebarLink) adminsSidebarLink.classList.remove("hidden");
        if (moduleCountBadge) moduleCountBadge.textContent = "8 Modules Available";
    } else {
        if (adminsCard) adminsCard.classList.add("hidden");
        if (adminsSidebarLink) adminsSidebarLink.classList.add("hidden");
        if (moduleCountBadge) moduleCountBadge.textContent = "7 Modules Available";
    }
}

/**
 * Render user info and status panel details
 */
function renderUserInfo(email, role) {
    const headerEmail = document.getElementById("header-user-email");
    const welcomeEmail = document.getElementById("welcome-user-email");
    const panelEmail = document.getElementById("panel-account-email");
    const panelRole = document.getElementById("panel-role-text");
    const panelAccess = document.getElementById("panel-access-level");

    if (headerEmail) headerEmail.textContent = email;
    if (welcomeEmail) welcomeEmail.textContent = email;
    if (panelEmail) panelEmail.textContent = email;
    if (panelRole) panelRole.textContent = role === "Owner" ? "Store Owner" : "System Administrator";
    if (panelAccess) panelAccess.textContent = role === "Owner" ? "Full Owner Privileges" : "Verified Admin Access";

    renderRoleBadge(role);
    renderDashboardCards(role);
}

/**
 * Verify admin document in Firestore
 */
async function verifyAdminAccess(user) {
    if (!user || !user.email) return false;

    // Check Owner condition first
    if (user.email === OWNER_EMAIL) {
        return "Owner";
    }

    try {
        const adminRef = doc(db, "admins", user.email);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists() && adminSnap.data().active === true) {
            return "Admin";
        }
    } catch (error) {
        console.error("Firestore permission or network error:", error);
    }

    return null;
}

/**
 * Setup mobile drawer navigation controls
 */
function setupSidebar() {
    const toggleBtn = document.getElementById("sidebar-toggle");
    const closeBtn = document.getElementById("sidebar-close");
    const overlay = document.getElementById("sidebar-overlay");
    const sidebar = document.getElementById("sidebar");
    const navItems = document.querySelectorAll(".sidebar-nav-item");

    if (!toggleBtn || !sidebar || !overlay) return;

    const openDrawer = () => {
        sidebar.classList.add("active");
        overlay.classList.add("active");
    };

    const closeDrawer = () => {
        sidebar.classList.remove("active");
        overlay.classList.remove("active");
    };

    toggleBtn.addEventListener("click", openDrawer);
    if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
    overlay.addEventListener("click", closeDrawer);

    navItems.forEach(item => {
        item.addEventListener("click", closeDrawer);
    });
}

/**
 * Setup Firebase Logout Action
 */
function setupLogout() {
    const logoutBtn = document.getElementById("logout-btn");
    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            showToast("Successfully signed out.", "success");
            setTimeout(() => {
                window.location.href = "/login.html";
            }, 600);
        } catch (error) {
            console.error("Logout error:", error);
            showToast("Failed to sign out. Please try again.", "error");
        }
    });
}

/**
 * Main Authentication State Observer & Initializer
 */
function observeAuthState() {
    const authLoader = document.getElementById("auth-loader");
    const appContainer = document.getElementById("app-container");

    onAuthStateChanged(auth, async (user) => {
        if (!user || !user.email) {
            redirectToLogin();
            return;
        }

        try {
            const role = await verifyAdminAccess(user);

            if (!role) {
                showToast("You do not have permission to access this dashboard.", "error");
                await signOut(auth);
                setTimeout(redirectToLogin, 1200);
                return;
            }

            // Authentication & Authorization passed successfully
            renderUserInfo(user.email, role);

            // Reveal dashboard content safely
            if (authLoader) authLoader.classList.add("hidden");
            if (appContainer) appContainer.classList.remove("hidden");

        } catch (error) {
            console.error("Access verification error:", error);
            showToast("Unable to verify your account. Please login again.", "error");
            setTimeout(redirectToLogin, 1500);
        }
    });
}

/**
 * Initialize Dashboard Application
 */
function initializeDashboard() {
    setupSidebar();
    setupLogout();
    observeAuthState();
}

// Run execution on DOM ready
document.addEventListener("DOMContentLoaded", initializeDashboard);
