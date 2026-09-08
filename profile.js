import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBEZA5iQBxOUJaKvFMtpVi6w-jMATNESoA",
  authDomain: "gadget-item.firebaseapp.com",
  projectId: "gadget-item",
  storageBucket: "gadget-item.firebasestorage.app",
  messagingSenderId: "1048854789116",
  appId: "1:1048854789116:web:91c20aa6dd633815be5079",
  measurementId: "G-2YMX097PSJ"
};


// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const pageLoader = document.getElementById("page-loader");
const appContainer = document.getElementById("app-container");
const profileEmailEl = document.getElementById("profile-email");
const profileNameEl = document.getElementById("profile-name");
const avatarContainer = document.getElementById("avatar-container");
const headerCartBadge = document.getElementById("header-cart-badge");
const menuCartCount = document.getElementById("menu-cart-count");
const navCartBadge = document.getElementById("nav-cart-badge");
const logoutTriggerBtn = document.getElementById("logout-trigger-btn");
const logoutModal = document.getElementById("logout-modal");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const modalConfirmLogoutBtn = document.getElementById("modal-confirm-logout-btn");
const currentYearEl = document.getElementById("current-year");
const toastContainer = document.getElementById("toast-container");

// Set Dynamic Current Year
if (currentYearEl) {
    currentYearEl.textContent = new Date().getFullYear();
}

// Custom Toast System
function showToast(message, type = "info") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let iconSvg = `<svg class="icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    if (type === "success") {
        iconSvg = `<svg class="icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === "error") {
        iconSvg = `<svg class="icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    }

    toast.innerHTML = `${iconSvg} <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Authentication State Observer
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Immediately redirect unauthenticated users
        window.location.href = "/login";
        return;
    }

    try {
        // Populate User Info securely from Auth state
        const email = user.email || "No email available";
        const displayName = user.displayName || "Gadgeta User";
        const photoURL = user.photoURL;

        if (profileEmailEl) profileEmailEl.textContent = email;
        if (profileNameEl) profileNameEl.textContent = displayName;

        if (avatarContainer) {
            if (photoURL) {
                avatarContainer.innerHTML = `<img src="${photoURL}" alt="User Avatar" class="profile-avatar-img">`;
            } else {
                avatarContainer.innerHTML = `
                    <svg class="icon" viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                `;
            }
        }

        // Fetch Cart Count from Firestore using precise querying
        await fetchUserCartCount(user.uid);

    } catch (error) {
        console.error("Error setting up profile data:", error);
        showToast("Unable to load profile data properly.", "error");
        setCartCountUI(0);
    } finally {
        // Reveal profile interface once verification completes
        if (pageLoader) pageLoader.style.display = "none";
        if (appContainer) appContainer.style.display = "flex";
    }
});

// Robust Firestore Cart Count Retrieval
async function fetchUserCartCount(uid) {
    try {
        const q = query(collection(db, "carts"), where("uid", "==", uid));
        const snapshot = await getDocs(q);
        
        let totalCartCount = 0;

        if (!snapshot.empty) {
            snapshot.forEach((docSnap) => {
                const cartData = docSnap.data();
                if (cartData && Array.isArray(cartData.items)) {
                    totalCartCount += cartData.items.length;
                }
            });
        }

        setCartCountUI(totalCartCount);
    } catch (error) {
        console.error("Firestore Cart Fetch Error:", error);
        showToast("Unable to load cart information.", "error");
        setCartCountUI(0);
    }
}

// Update Cart Count in Header and Bottom Navigation
function setCartCountUI(count) {
    const safeCount = Math.max(0, count);
    if (headerCartBadge) headerCartBadge.textContent = safeCount;
    if (menuCartCount) menuCartCount.textContent = safeCount;
    if (navCartBadge) navCartBadge.textContent = safeCount;
}

// Custom Logout Modal & Process
if (logoutTriggerBtn && logoutModal) {
    logoutTriggerBtn.addEventListener("click", () => {
        logoutModal.style.display = "flex";
    });
}

if (modalCancelBtn && logoutModal) {
    modalCancelBtn.addEventListener("click", () => {
        logoutModal.style.display = "none";
    });
}

if (logoutModal) {
    logoutModal.addEventListener("click", (e) => {
        if (e.target === logoutModal) {
            logoutModal.style.display = "none";
        }
    });
}

if (modalConfirmLogoutBtn) {
    modalConfirmLogoutBtn.addEventListener("click", async () => {
        try {
            modalConfirmLogoutBtn.textContent = "Logging out...";
            modalConfirmLogoutBtn.disabled = true;
            
            await signOut(auth);
            showToast("Logged out successfully", "success");
            
            setTimeout(() => {
                window.location.href = "/login";
            }, 500);
        } catch (error) {
            console.error("Logout Error:", error);
            showToast("Something went wrong during logout.", "error");
            modalConfirmLogoutBtn.textContent = "Log Out";
            modalConfirmLogoutBtn.disabled = false;
            if (logoutModal) logoutModal.style.display = "none";
        }
    });
}
