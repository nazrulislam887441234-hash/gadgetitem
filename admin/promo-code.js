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

// Firebase configuration initialization
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

// Application State Store
let allPromosData = [];
let lastVisibleDoc = null;
let hasMoreData = true;
let isFetching = false;
let currentSearchQuery = "";
let currentEditOriginalCode = null;
let currentDeleteCodeTarget = null;

// DOM Elements Reference
const authLoadingScreen = document.getElementById("auth-loading-screen");
const adminLayout = document.getElementById("admin-layout");
const userEmailDisplay = document.getElementById("user-email-display");
const userRoleBadge = document.getElementById("user-role-badge");
const logoutBtn = document.getElementById("logout-btn");

const promoTableBody = document.getElementById("promo-table-body");
const emptyState = document.getElementById("empty-state");
const errorState = document.getElementById("error-state");
const errorMessageText = document.getElementById("error-message-text");
const retryFetchBtn = document.getElementById("retry-fetch-btn");
const loadMoreContainer = document.getElementById("load-more-container");
const loadMoreBtn = document.getElementById("load-more-btn");
const searchInput = document.getElementById("search-input");

// Stats Elements
const statTotal = document.getElementById("stat-total");
const statActive = document.getElementById("stat-active");
const statInactive = document.getElementById("stat-inactive");
const statExpired = document.getElementById("stat-expired");

// Modals & Forms
const promoModal = document.getElementById("promo-modal");
const openCreateModalBtn = document.getElementById("open-create-modal-btn");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const promoForm = document.getElementById("promo-form");
const modalTitle = document.getElementById("modal-title");
const formCode = document.getElementById("form-code");
const formOriginalCode = document.getElementById("form-original-code");
const formDiscount = document.getElementById("form-discount");
const formLimit = document.getElementById("form-limit");
const formExpiry = document.getElementById("form-expiry");
const formActive = document.getElementById("form-active");
const formFeedback = document.getElementById("form-feedback");
const modalSaveBtn = document.getElementById("modal-save-btn");

const confirmModal = document.getElementById("confirm-modal");
const confirmTargetCode = document.getElementById("confirm-target-code");
const confirmCancelBtn = document.getElementById("confirm-cancel-btn");
const confirmProceedBtn = document.getElementById("confirm-proceed-btn");

const appToast = document.getElementById("app-toast");
const toastMsg = document.getElementById("toast-msg");

// Security & Authentication Verification Flow
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/login");
        return;
    }

    const email = user.email;

    try {
        if (email === OWNER_EMAIL) {
            grantAccess(email, "Owner");
            return;
        }

        // Verify Admin collection record
        const adminDocRef = doc(db, "admins", email);
        const adminSnap = await getDoc(adminDocRef);

        if (adminSnap.exists() && adminSnap.data().active === true) {
            grantAccess(email, "Admin");
        } else {
            throw new Error("Unauthorized administrative access level.");
        }
    } catch (err) {
        console.error("Authorization verification failed:", err);
        await signOut(auth);
        window.location.replace("/login");
    }
});

function grantAccess(email, role) {
    userEmailDisplay.textContent = email;
    userRoleBadge.textContent = role;
    authLoadingScreen.style.display = "none";
    adminLayout.style.display = "flex";
    
    // Initialize Dashboard data load
    loadPromosFirstBatch();
}

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.replace("/login");
    } catch (err) {
        showToast("Error signing out.");
    }
});

// Fetch Promos with Pagination
async function loadPromosFirstBatch() {
    if (isFetching) return;
    isFetching = true;
    hideStates();

    try {
        allPromosData = [];
        lastVisibleDoc = null;
        hasMoreData = true;

        const promoColRef = collection(db, "promoCode");
        const q = query(promoColRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            renderPromosList();
            updateStatistics();
            isFetching = false;
            return;
        }

        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        snapshot.forEach((docSnap) => {
            allPromosData.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (snapshot.docs.length < PAGE_SIZE) {
            hasMoreData = false;
        }

        renderPromosList();
        updateStatistics();
    } catch (err) {
        console.error("Error loading promos:", err);
        showErrorState(err.message);
    } finally {
        isFetching = false;
    }
}

async function loadMorePromosBatch() {
    if (isFetching || !hasMoreData) return;
    isFetching = true;
    loadMoreBtn.textContent = "Loading...";

    try {
        const promoColRef = collection(db, "promoCode");
        const q = query(
            promoColRef, 
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
            allPromosData.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (snapshot.docs.length < PAGE_SIZE) {
            hasMoreData = false;
        }

        renderPromosList();
        updateStatistics();
    } catch (err) {
        console.error("Error loading more promos:", err);
        showToast("Failed to load more promo items.");
    } finally {
        isFetching = false;
        loadMoreBtn.textContent = "Load More Promos";
    }
}

loadMoreBtn.addEventListener("click", loadMorePromosBatch);
retryFetchBtn.addEventListener("click", loadPromosFirstBatch);

// Search Filtering
searchInput.addEventListener("input", (e) => {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    renderPromosList();
});

// Render Table Layout & States
function renderPromosList() {
    let filtered = allPromosData;
    if (currentSearchQuery) {
        filtered = allPromosData.filter(p => p.id.toLowerCase().includes(currentSearchQuery));
    }

    promoTableBody.innerHTML = "";

    if (allPromosData.length === 0) {
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

    filtered.forEach(promo => {
        const tr = document.createElement("tr");

        // Compute Status Logic: Active, Inactive, Expired (expired <= Date.now())
        const now = Date.now();
        const isExpired = promo.expired <= now;
        let statusBadgeHTML = "";

        if (isExpired) {
            statusBadgeHTML = `<span class="badge expired">Expired</span>`;
        } else if (promo.active === true) {
            statusBadgeHTML = `<span class="badge active">Active</span>`;
        } else {
            statusBadgeHTML = `<span class="badge inactive">Inactive</span>`;
        }

        // Format Dates
        const expiryDateStr = new Date(promo.expired).toLocaleString();
        const createdDateStr = promo.createdAt && promo.createdAt.seconds 
            ? new Date(promo.createdAt.seconds * 1000).toLocaleDateString() 
            : "Just now";

        tr.innerHTML = `
            <td><strong>${escapeHTML(promo.id)}</strong></td>
            <td>BDT ${Number(promo.Discount).toLocaleString()}</td>
            <td>BDT ${Number(promo.shoppingLimit || 0).toLocaleString()}</td>
            <td>${expiryDateStr}</td>
            <td>${statusBadgeHTML}</td>
            <td>${createdDateStr}</td>
            <td class="text-right">
                <div class="action-cell">
                    <button class="action-icon-btn edit-action" data-code="${escapeHTML(promo.id)}" title="Edit Promo">
                        <svg class="action-icon" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    <button class="action-icon-btn delete-action" data-code="${escapeHTML(promo.id)}" title="Delete Promo">
                        <svg class="action-icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            </td>
        `;
        promoTableBody.appendChild(tr);
    });

    // Handle Load More Visibility
    if (hasMoreData && !currentSearchQuery) {
        loadMoreContainer.style.display = "block";
    } else {
        loadMoreContainer.style.display = "none";
    }

    // Bind Row Action Buttons
    document.querySelectorAll(".edit-action").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const code = e.currentTarget.getAttribute("data-code");
            openEditModal(code);
        });
    });

    document.querySelectorAll(".delete-action").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const code = e.currentTarget.getAttribute("data-code");
            openDeleteConfirmation(code);
        });
    });
}

// Compute Statistics Counters
function updateStatistics() {
    const now = Date.now();
    let total = allPromosData.length;
    let activeCount = 0;
    let inactiveCount = 0;
    let expiredCount = 0;

    allPromosData.forEach(p => {
        if (p.expired <= now) {
            expiredCount++;
        } else if (p.active === true) {
            activeCount++;
        } else {
            inactiveCount++;
        }
    });

    statTotal.textContent = total;
    statActive.textContent = activeCount;
    statInactive.textContent = inactiveCount;
    statExpired.textContent = expiredCount;
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

// Modal Form Management (Create / Edit)
openCreateModalBtn.addEventListener("click", () => {
    currentEditOriginalCode = null;
    modalTitle.textContent = "Create New Promo Code";
    modalSaveBtn.textContent = "Save Promo Code";
    promoForm.reset();
    formCode.disabled = false;
    formOriginalCode.value = "";
    
    // Default expiration to tomorrow
    const tomorrow = new Date(Date.now() + 86400000);
    formExpiry.value = formatDateTimeLocal(tomorrow);
    formActive.checked = true;
    hideFormFeedback();
    promoModal.style.display = "flex";
});

function openEditModal(code) {
    const promo = allPromosData.find(p => p.id === code);
    if (!promo) return;

    currentEditOriginalCode = promo.id;
    modalTitle.textContent = `Edit Promo Code: ${promo.id}`;
    modalSaveBtn.textContent = "Update Promo Code";
    
    formCode.value = promo.id;
    formOriginalCode.value = promo.id;
    formCode.disabled = false; // Allow modifying code name carefully
    formDiscount.value = promo.Discount;
    formLimit.value = promo.shoppingLimit || 0;
    formExpiry.value = formatDateTimeLocal(new Date(promo.expired));
    formActive.checked = promo.active === true;
    
    hideFormFeedback();
    promoModal.style.display = "flex";
}

function closeModal() {
    promoModal.style.display = "none";
}

modalCloseBtn.addEventListener("click", closeModal);
modalCancelBtn.addEventListener("click", closeModal);

// Handle Create / Edit Submission with strict rules & atomic code switching
promoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideFormFeedback();

    const rawCode = formCode.value.trim();
    const promoCodeId = rawCode.toUpperCase();
    const discountVal = parseFloat(formDiscount.value);
    const limitVal = parseFloat(formLimit.value);
    const expiryDateVal = new Date(formExpiry.value);
    const expiryMs = expiryDateVal.getTime();
    const isActive = formActive.checked;

    // Validation Rules
    if (!promoCodeId) {
        showFormFeedback("Promo code identifier is required.");
        return;
    }
    if (isNaN(discountVal) || discountVal <= 0) {
        showFormFeedback("Discount must be a valid positive number greater than 0.");
        return;
    }
    if (isNaN(limitVal) || limitVal < 0) {
        showFormFeedback("Shopping limit must be a valid non-negative number.");
        return;
    }
    if (isNaN(expiryMs) || expiryMs <= Date.now()) {
        showFormFeedback("Expiration date and time must be set strictly in the future.");
        return;
    }

    modalSaveBtn.disabled = true;
    modalSaveBtn.textContent = "Processing...";

    try {
        const docRef = doc(db, "promoCode", promoCodeId);

        // Check Duplication if creating new or renaming code ID
        if (!currentEditOriginalCode || currentEditOriginalCode !== promoCodeId) {
            const existingSnap = await getDoc(docRef);
            if (existingSnap.exists()) {
                throw new Error(`Promo code "${promoCodeId}" already exists in database. Choose a unique code.`);
            }
        }

        const promoPayload = {
            promocode: promoCodeId,
            active: isActive,
            expired: expiryMs,
            Discount: discountVal,
            shoppingLimit: limitVal,
            createdAt: serverTimestamp()
        };

        // If editing and code identifier changed, create new doc first, then delete old atomically
        if (currentEditOriginalCode && currentEditOriginalCode !== promoCodeId) {
            // Preserve original createdAt if editing
            const oldPromo = allPromosData.find(p => p.id === currentEditOriginalCode);
            if (oldPromo && oldPromo.createdAt) {
                promoPayload.createdAt = oldPromo.createdAt;
            }

            // 1. Create new doc
            await setDoc(docRef, promoPayload);
            // 2. Delete old doc
            await deleteDoc(doc(db, "promoCode", currentEditOriginalCode));
            showToast("Promo code updated & re-indexed successfully.");
        } else {
            // Standard create or update same ID
            if (currentEditOriginalCode) {
                const oldPromo = allPromosData.find(p => p.id === currentEditOriginalCode);
                if (oldPromo && oldPromo.createdAt) {
                    promoPayload.createdAt = oldPromo.createdAt;
                }
            }
            await setDoc(docRef, promoPayload, { merge: true });
            showToast(currentEditOriginalCode ? "Promo code updated successfully." : "Promo code created successfully.");
        }

        closeModal();
        loadPromosFirstBatch();
    } catch (err) {
        console.error("Save promo error:", err);
        showFormFeedback(err.message);
    } finally {
        modalSaveBtn.disabled = false;
        modalSaveBtn.textContent = currentEditOriginalCode ? "Update Promo Code" : "Save Promo Code";
    }
});

// Deletion with Confirmation Modal
function openDeleteConfirmation(code) {
    currentDeleteCodeTarget = code;
    confirmTargetCode.textContent = code;
    confirmModal.style.display = "flex";
}

function closeConfirmModal() {
    confirmModal.style.display = "none";
    currentDeleteCodeTarget = null;
}

confirmCancelBtn.addEventListener("click", closeConfirmModal);

confirmProceedBtn.addEventListener("click", async () => {
    if (!currentDeleteCodeTarget) return;

    confirmProceedBtn.disabled = true;
    confirmProceedBtn.textContent = "Deleting...";

    try {
        await deleteDoc(doc(db, "promoCode", currentDeleteCodeTarget));
        showToast(`Promo code "${currentDeleteCodeTarget}" permanently deleted.`);
        closeConfirmModal();
        loadPromosFirstBatch();
    } catch (err) {
        console.error("Deletion error:", err);
        showToast("Failed to delete promo code.");
    } finally {
        confirmProceedBtn.disabled = false;
        confirmProceedBtn.textContent = "Delete Permanently";
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

function formatDateTimeLocal(dateObj) {
    const pad = (n) => n < 10 ? '0' + n : n;
    const year = dateObj.getFullYear();
    const month = pad(dateObj.getMonth() + 1);
    const day = pad(dateObj.getDate());
    const hours = pad(dateObj.getHours());
    const minutes = pad(dateObj.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
