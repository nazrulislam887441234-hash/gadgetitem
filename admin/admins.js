import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    deleteDoc, 
    collection, 
    query, 
    orderBy, 
    limit, 
    startAfter, 
    getDocs, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Exact Firebase Configuration
const firebaseConfig = { 
    apiKey: "AIzaSyBEZA5iQBxOUJaKvFMtpVi6w-jMATNESoA", 
    authDomain: "gadget-item.firebaseapp.com", 
    projectId: "gadget-item", 
    storageBucket: "gadget-item.firebasestorage.app", 
    messagingSenderId: "1048854789116", 
    appId: "1:1048854789116:web:91c20aa6dd633815be5079", 
    measurementId: "G-2YMX097PSJ" 
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const OWNER_EMAIL = "nazrulislam887441234@gmail.com";
const PAGE_SIZE = 20;

// Application State
let allAdminsData = [];
let lastVisibleDoc = null;
let hasMoreData = true;
let isFetching = false;
let currentSearchQuery = "";
let currentStatusFilter = "all";
let currentEditOriginalEmail = null;
let currentDeleteEmailTarget = null;

// DOM Element References
const authLoadingScreen = document.getElementById("auth-loading-screen");
const adminLayout = document.getElementById("admin-layout");
const userEmailDisplay = document.getElementById("user-email-display");
const logoutBtn = document.getElementById("logout-btn");

const adminTableBody = document.getElementById("admin-table-body");
const emptyState = document.getElementById("empty-state");
const errorState = document.getElementById("error-state");
const errorMessageText = document.getElementById("error-message-text");
const retryFetchBtn = document.getElementById("retry-fetch-btn");
const loadMoreContainer = document.getElementById("load-more-container");
const loadMoreBtn = document.getElementById("load-more-btn");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");

// Statistics Elements
const statTotal = document.getElementById("stat-total");
const statActive = document.getElementById("stat-active");
const statInactive = document.getElementById("stat-inactive");

// Modals & Forms
const adminModal = document.getElementById("admin-modal");
const openCreateModalBtn = document.getElementById("open-create-modal-btn");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const adminForm = document.getElementById("admin-form");
const modalTitle = document.getElementById("modal-title");
const formEmail = document.getElementById("form-email");
const formOriginalEmail = document.getElementById("form-original-email");
const formActive = document.getElementById("form-active");
const formFeedback = document.getElementById("form-feedback");
const modalSaveBtn = document.getElementById("modal-save-btn");

const confirmModal = document.getElementById("confirm-modal");
const confirmTargetEmail = document.getElementById("confirm-target-email");
const confirmCancelBtn = document.getElementById("confirm-cancel-btn");
const confirmProceedBtn = document.getElementById("confirm-proceed-btn");

const appToast = document.getElementById("app-toast");
const toastMsg = document.getElementById("toast-msg");

// Strict Security Verification Flow (Owner Only)
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/login");
        return;
    }

    const email = user.email;

    // Strict Owner Enforcement Rule: Only exact owner email can access owner-panel
    if (email !== OWNER_EMAIL) {
        console.warn("Unauthorized user attempting access to Owner Panel:", email);
        await signOut(auth);
        window.location.replace("/login");
        return;
    }

    // Grant Access
    userEmailDisplay.textContent = email;
    authLoadingScreen.style.display = "none";
    adminLayout.style.display = "flex";

    // Load Initial Batch of Admins
    loadAdminsFirstBatch();
});

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.replace("/login");
    } catch (err) {
        showToast("Error signing out.");
    }
});

// Fetch Admins with Pagination
async function loadAdminsFirstBatch() {
    if (isFetching) return;
    isFetching = true;
    hideStates();

    try {
        allAdminsData = [];
        lastVisibleDoc = null;
        hasMoreData = true;

        const adminColRef = collection(db, "admins");
        const q = query(adminColRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            renderAdminsList();
            updateStatistics();
            isFetching = false;
            return;
        }

        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        snapshot.forEach((docSnap) => {
            allAdminsData.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (snapshot.docs.length < PAGE_SIZE) {
            hasMoreData = false;
        }

        renderAdminsList();
        updateStatistics();
    } catch (err) {
        console.error("Error loading admins:", err);
        showErrorState(err.message);
    } finally {
        isFetching = false;
    }
}

async function loadMoreAdminsBatch() {
    if (isFetching || !hasMoreData) return;
    isFetching = true;
    loadMoreBtn.textContent = "Loading...";

    try {
        const adminColRef = collection(db, "admins");
        const q = query(
            adminColRef, 
            orderBy("createdAt", "desc"), 
            startAfter(lastVisibleDoc), 
            limit(PAGE_SIZE)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            hasMoreData = false;
            loadMoreContainer.style.display = "none";
            isFetching = false;
            return;
        }

        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        snapshot.forEach((docSnap) => {
            allAdminsData.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (snapshot.docs.length < PAGE_SIZE) {
            hasMoreData = false;
        }

        renderAdminsList();
        updateStatistics();
    } catch (err) {
        console.error("Error loading more admins:", err);
        showToast("Failed to load more admin records.");
    } finally {
        isFetching = false;
        loadMoreBtn.textContent = "Load More Admins";
    }
}

loadMoreBtn.addEventListener("click", loadMoreAdminsBatch);
retryFetchBtn.addEventListener("click", loadAdminsFirstBatch);

// Search & Filter Listeners
searchInput.addEventListener("input", (e) => {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    renderAdminsList();
});

statusFilter.addEventListener("change", (e) => {
    currentStatusFilter = e.target.value;
    renderAdminsList();
});

// Render Admin Table & Empty/Error States
function renderAdminsList() {
    let filtered = allAdminsData;

    // Search query filter
    if (currentSearchQuery) {
        filtered = filtered.filter(a => a.email.toLowerCase().includes(currentSearchQuery));
    }

    // Status filter
    if (currentStatusFilter === "active") {
        filtered = filtered.filter(a => a.active === true);
    } else if (currentStatusFilter === "inactive") {
        filtered = filtered.filter(a => a.active === false);
    }

    adminTableBody.innerHTML = "";

    if (allAdminsData.length === 0) {
        emptyState.style.display = "flex";
        loadMoreContainer.style.display = "none";
        return;
    }

    if (filtered.length === 0) {
        emptyState.style.display = "flex";
        loadMoreContainer.style.display = "none";
        return;
    }

    emptyState.style.display = "none";

    filtered.forEach(admin => {
        const tr = document.createElement("tr");

        const isActive = admin.active === true;
        const statusBadgeHTML = isActive 
            ? `<span class="badge active">Active</span>` 
            : `<span class="badge inactive">Inactive</span>`;

        const createdDateStr = admin.createdAt && admin.createdAt.seconds 
            ? new Date(admin.createdAt.seconds * 1000).toLocaleDateString() 
            : "Just now";

        tr.innerHTML = `
            <td><strong>${escapeHTML(admin.email)}</strong></td>
            <td>${statusBadgeHTML}</td>
            <td>${createdDateStr}</td>
            <td class="text-right">
                <div class="action-cell">
                    <button class="action-icon-btn edit-action" data-email="${escapeHTML(admin.email)}" title="Edit Admin">
                        <svg class="action-icon" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="action-icon-btn delete-action" data-email="${escapeHTML(admin.email)}" title="Delete Admin">
                        <svg class="action-icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            </td>
        `;
        adminTableBody.appendChild(tr);
    });

    if (hasMoreData && !currentSearchQuery && currentStatusFilter === "all") {
        loadMoreContainer.style.display = "block";
    } else {
        loadMoreContainer.style.display = "none";
    }

    // Bind Row Action Buttons
    document.querySelectorAll(".edit-action").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const email = e.currentTarget.getAttribute("data-email");
            openEditModal(email);
        });
    });

    document.querySelectorAll(".delete-action").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const email = e.currentTarget.getAttribute("data-email");
            openDeleteConfirmation(email);
        });
    });
}

// Compute Statistics
function updateStatistics() {
    let total = allAdminsData.length;
    let activeCount = allAdminsData.filter(a => a.active === true).length;
    let inactiveCount = total - activeCount;

    statTotal.textContent = total;
    statActive.textContent = activeCount;
    statInactive.textContent = inactiveCount;
}

function hideStates() {
    emptyState.style.display = "none";
    errorState.style.display = "none";
}

function showErrorState(msg) {
    errorMessageText.textContent = msg;
    errorState.style.display = "flex";
    emptyState.style.display = "none";
    loadMoreContainer.style.display = "none";
}

// Modal Management (Create / Edit)
openCreateModalBtn.addEventListener("click", () => {
    currentEditOriginalEmail = null;
    modalTitle.textContent = "Add New Administrator";
    modalSaveBtn.textContent = "Save Administrator";
    adminForm.reset();
    formEmail.disabled = false;
    formOriginalEmail.value = "";
    formActive.checked = true;
    hideFormFeedback();
    adminModal.style.display = "flex";
});

function openEditModal(email) {
    const admin = allAdminsData.find(a => a.email === email);
    if (!admin) return;

    currentEditOriginalEmail = admin.email;
    modalTitle.textContent = `Edit Administrator: ${admin.email}`;
    modalSaveBtn.textContent = "Update Administrator";
    
    formEmail.value = admin.email;
    formOriginalEmail.value = admin.email;
    formEmail.disabled = false; // Allow modifying email if needed
    formActive.checked = admin.active === true;
    
    hideFormFeedback();
    adminModal.style.display = "flex";
}

function closeModal() {
    adminModal.style.display = "none";
}

modalCloseBtn.addEventListener("click", closeModal);
modalCancelBtn.addEventListener("click", closeModal);

// Handle Create / Edit Submission with Atomic Record Re-indexing
adminForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormFeedback();

    const emailInputVal = formEmail.value.trim().toLowerCase();
    const isActive = formActive.checked;

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInputVal)) {
        showFormFeedback("Please enter a valid administrator email address format.");
        return;
    }

    // Prevent Owner email from being registered as a normal admin doc
    if (emailInputVal === OWNER_EMAIL.toLowerCase()) {
        showFormFeedback("The Owner email already possesses root privileges by default and cannot be added as a subordinate admin record.");
        return;
    }

    modalSaveBtn.disabled = true;
    modalSaveBtn.textContent = "Processing...";

    try {
        const docRef = doc(db, "admins", emailInputVal);

        // Check if new email already exists
        if (!currentEditOriginalEmail || currentEditOriginalEmail !== emailInputVal) {
            const existingSnap = await getDoc(docRef);
            if (existingSnap.exists()) {
                throw new Error(`Administrator "${emailInputVal}" already exists in the database.`);
            }
        }

        const adminPayload = {
            email: emailInputVal,
            active: isActive,
            createdAt: serverTimestamp()
        };

        // If editing and email changed, safely create new doc first, then delete old doc
        if (currentEditOriginalEmail && currentEditOriginalEmail !== emailInputVal) {
            const oldAdmin = allAdminsData.find(a => a.email === currentEditOriginalEmail);
            if (oldAdmin && oldAdmin.createdAt) {
                adminPayload.createdAt = oldAdmin.createdAt;
            }

            // 1. Create new document
            await setDoc(docRef, adminPayload);
            // 2. Delete old document
            await deleteDoc(doc(db, "admins", currentEditOriginalEmail));
            showToast("Administrator email updated & re-indexed successfully.");
        } else {
            if (currentEditOriginalEmail) {
                const oldAdmin = allAdminsData.find(a => a.email === currentEditOriginalEmail);
                if (oldAdmin && oldAdmin.createdAt) {
                    adminPayload.createdAt = oldAdmin.createdAt;
                }
            }
            await setDoc(docRef, adminPayload, { merge: true });
            showToast(currentEditOriginalEmail ? "Administrator updated successfully." : "Administrator created successfully.");
        }

        closeModal();
        loadAdminsFirstBatch();
    } catch (err) {
        console.error("Save admin error:", err);
        showFormFeedback(err.message);
    } finally {
        modalSaveBtn.disabled = false;
        modalSaveBtn.textContent = currentEditOriginalEmail ? "Update Administrator" : "Save Administrator";
    }
});

// Deletion with Confirmation Modal
function openDeleteConfirmation(email) {
    currentDeleteEmailTarget = email;
    confirmTargetEmail.textContent = email;
    confirmModal.style.display = "flex";
}

function closeConfirmModal() {
    confirmModal.style.display = "none";
    currentDeleteEmailTarget = null;
}

confirmCancelBtn.addEventListener("click", closeConfirmModal);

confirmProceedBtn.addEventListener("click", async () => {
    if (!currentDeleteEmailTarget) return;

    confirmProceedBtn.disabled = true;
    confirmProceedBtn.textContent = "Revoking...";

    try {
        await deleteDoc(doc(db, "admins", currentDeleteEmailTarget));
        showToast(`Administrative authorization revoked for "${currentDeleteEmailTarget}".`);
        closeConfirmModal();
        loadAdminsFirstBatch();
    } catch (err) {
        console.error("Admin deletion error:", err);
        showToast("Failed to revoke admin authorization.");
    } finally {
        confirmProceedBtn.disabled = false;
        confirmProceedBtn.textContent = "Revoke & Delete";
    }
});

// Utilities & Helpers
function showFormFeedback(msg) {
    formFeedback.textContent = msg;
    formFeedback.style.display = "block";
}

function hideFormFeedback() {
    formFeedback.style.display = "none";
    formFeedback.textContent = "";
}

function showToast(msg) {
    toastMsg.textContent = msg;
    appToast.style.display = "block";
    setTimeout(() => {
        appToast.style.display = "none";
    }, 3000);
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
