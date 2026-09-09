import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBEZA5iQBxOUJaKvFMtpVi6w-jMATNESoA",
  authDomain: "gadget-item.firebaseapp.com",
  projectId: "gadget-item",
  storageBucket: "gadget-item.firebasestorage.app",
  messagingSenderId: "1048854789116",
  appId: "1:1048854789116:web:91c20aa6dd633815be5079",
  measurementId: "G-2YMX097PSJ"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Owner Email Configuration (Replace with owner's email)
const OWNER_EMAIL = "nazrulislam887441234@gmail.com"; // এখানে আপনার ওনার ইমেইল সেট করা আছে

// ==========================================
// STATE MANAGEMENT & DOM REFERENCES
// ==========================================
let currentUser = null;
let currentApiDocId = null;
let currentRawApiKey = "";
let isApiKeyVisible = false;
let isOwner = false;

// Screens
const authScreen = document.getElementById('authScreen');
const dashboardScreen = document.getElementById('dashboardScreen');

// Auth DOM
const loginForm = document.getElementById('loginForm');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const toggleLoginPasswordBtn = document.getElementById('toggleLoginPassword');
const loginBtn = document.getElementById('loginBtn');
const authError = document.getElementById('authError');
const logoutBtn = document.getElementById('logoutBtn');
const userEmailDisplay = document.getElementById('userEmailDisplay');

// Dashboard DOM
const dashboardLoader = document.getElementById('dashboardLoader');
const emptyStateView = document.getElementById('emptyStateView');
const configuredStateView = document.getElementById('configuredStateView');
const headerActionContainer = document.getElementById('headerActionContainer');
const addKeyBtn = document.getElementById('addKeyBtn');
const editKeyBtn = document.getElementById('editKeyBtn');
const deleteKeyBtn = document.getElementById('deleteKeyBtn');

// Status Card DOM
const statusText = document.getElementById('statusText');
const statusIconWrap = document.getElementById('statusIconWrap');
const statusSvg = document.getElementById('statusSvg');

// Configured Credential DOM
const displayApiName = document.getElementById('displayApiName');
const displayApiKey = document.getElementById('displayApiKey');
const displayEmail = document.getElementById('displayEmail');
const displayCreatedAt = document.getElementById('displayCreatedAt');
const toggleApiKeyVisibilityBtn = document.getElementById('toggleApiKeyVisibility');
const copyApiKeyBtn = document.getElementById('copyApiKeyBtn');

// Owner Section DOM
const ownerSection = document.getElementById('ownerSection');
const ownerTableBody = document.getElementById('ownerTableBody');

// Modal DOM (Add/Edit)
const apiKeyModal = document.getElementById('apiKeyModal');
const modalTitle = document.getElementById('modalTitle');
const apiKeyForm = document.getElementById('apiKeyForm');
const modalApiName = document.getElementById('modalApiName');
const modalApiKeyInput = document.getElementById('modalApiKeyInput');
const toggleModalApiKeyBtn = document.getElementById('toggleModalApiKey');
const modalEmail = document.getElementById('modalEmail');
const modalError = document.getElementById('modalError');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

// Delete Modal DOM
const deleteModal = document.getElementById('deleteModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
let targetDocIdToDelete = null; // Used for owner or single user delete

// Toast Container
const toastContainer = document.getElementById('toastContainer');

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconSvg = type === 'success' 
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function escapeHtml(str) {
    return str ? String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : "";
}

// ==========================================
// AUTHENTICATION STATE OBSERVER
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        isOwner = (user.email.toLowerCase() === OWNER_EMAIL.toLowerCase());
        authScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        userEmailDisplay.textContent = user.email || 'Admin';
        loadUserApiConfiguration();
    } else {
        currentUser = null;
        currentApiDocId = null;
        currentRawApiKey = "";
        isOwner = false;
        dashboardScreen.classList.add('hidden');
        authScreen.classList.remove('hidden');
        loginForm.reset();
        hideAuthError();
    }
});

// ==========================================
// LOGIN HANDLER
// ==========================================
toggleLoginPasswordBtn.addEventListener('click', () => {
    const type = loginPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    loginPasswordInput.setAttribute('type', type);
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAuthError();

    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;

    if (!email || !password) {
        showAuthError('Please enter both email and password.');
        return;
    }

    setLoading(loginBtn, true, 'Signing in...');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Logged in successfully', 'success');
    } catch (error) {
        console.error('Login error:', error);
        showAuthError(getFriendlyAuthErrorMessage(error.code));
    } finally {
        setLoading(loginBtn, false, 'Sign In');
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Failed to log out properly.', 'error');
    }
});

function showAuthError(message) {
    authError.textContent = message;
    authError.classList.remove('hidden');
}

function hideAuthError() {
    authError.textContent = '';
    authError.classList.add('hidden');
}

function getFriendlyAuthErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            return 'Invalid email or password.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
            return 'Access temporarily blocked due to many failed login attempts. Try again later.';
        default:
            return 'Authentication failed. Please check your credentials.';
    }
}

// ==========================================
// FIRESTORE CRUD & DATA MANAGEMENT
// ==========================================
async function loadUserApiConfiguration() {
    if (!currentUser) return;

    showDashboardLoader(true);
    hideAllDashboardStates();

    try {
        // Query strictly by UID so user only sees their own document
        const q = query(
            collection(db, "imgbb_api"),
            where("uid", "==", currentUser.uid)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            const data = docSnap.data();
            currentApiDocId = docSnap.id;
            currentRawApiKey = data.apiKey || "";

            renderConfiguredState(data);
        } else {
            currentApiDocId = null;
            currentRawApiKey = "";
            renderEmptyState();
        }

        // If user is Owner, also load all documents into the owner section table
        if (isOwner) {
            ownerSection.classList.remove('hidden');
            loadOwnerAllDocuments();
        } else {
            ownerSection.classList.add('hidden');
        }

    } catch (error) {
        console.error('Error loading API configuration:', error);
        showToast('Failed to load API configuration. Check security rules or network.', 'error');
        renderEmptyState();
    } finally {
        showDashboardLoader(false);
    }
}

async function loadOwnerAllDocuments() {
    try {
        const querySnapshot = await getDocs(collection(db, "imgbb_api"));
        ownerTableBody.innerHTML = '';

        if (querySnapshot.empty) {
            ownerTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 15px; color: var(--text-muted);">No documents found in database.</td></tr>`;
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid var(--border-color)";
            tr.innerHTML = `
                <td style="padding: 10px; font-size: 13px;">${escapeHtml(data.email || 'N/A')}</td>
                <td style="padding: 10px; font-size: 12px; font-family: monospace;">${escapeHtml(data.uid || 'N/A')}</td>
                <td style="padding: 10px; font-size: 13px; font-family: monospace;">••••••••••••</td>
                <td style="padding: 10px; display: flex; gap: 8px;">
                    <button class="btn btn-outline btn-sm owner-edit-btn" data-id="${docSnap.id}">Edit</button>
                    <button class="btn btn-danger-outline btn-sm owner-delete-btn" data-id="${docSnap.id}">Delete</button>
                </td>
            `;
            ownerTableBody.appendChild(tr);
        });

        // Attach listeners for owner action buttons
        document.querySelectorAll('.owner-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const docId = e.currentTarget.getAttribute('data-id');
                openOwnerEditModal(docId);
            });
        });

        document.querySelectorAll('.owner-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const docId = e.currentTarget.getAttribute('data-id');
                targetDocIdToDelete = docId;
                deleteModal.classList.remove('hidden');
                deleteModal.setAttribute('aria-hidden', 'false');
            });
        });

    } catch (error) {
        console.error('Error loading owner table:', error);
    }
}

// Render UI States
function showDashboardLoader(show) {
    if (show) {
        dashboardLoader.classList.remove('hidden');
        emptyStateView.classList.add('hidden');
        configuredStateView.classList.add('hidden');
    } else {
        dashboardLoader.classList.add('hidden');
    }
}

function hideAllDashboardStates() {
    emptyStateView.classList.add('hidden');
    configuredStateView.classList.add('hidden');
    headerActionContainer.innerHTML = '';
}

function renderEmptyState() {
    emptyStateView.classList.remove('hidden');
    configuredStateView.classList.add('hidden');
    
    statusText.textContent = "Not Configured";
    statusIconWrap.className = "stat-icon-wrap warning-bg";
    statusSvg.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';

    headerActionContainer.innerHTML = `
        <button id="headerAddBtn" class="btn btn-primary btn-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add ImgBB API</span>
        </button>
    `;
    document.getElementById('headerAddBtn').addEventListener('click', openAddModal);
}

function renderConfiguredState(data) {
    emptyStateView.classList.add('hidden');
    configuredStateView.classList.remove('hidden');

    statusText.textContent = "Configured";
    statusIconWrap.className = "stat-icon-wrap success-bg";
    statusSvg.innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';

    headerActionContainer.innerHTML = `
        <button id="headerEditBtn" class="btn btn-outline btn-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 14h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>Edit API</span>
        </button>
    `;
    document.getElementById('headerEditBtn').addEventListener('click', openEditModal);

    displayApiName.textContent = data.name || "imgbb";
    isApiKeyVisible = false;
    updateApiKeyDisplay();

    displayEmail.textContent = data.email || currentUser.email;
    
    if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        displayCreatedAt.textContent = data.createdAt.toDate().toLocaleString();
    } else {
        displayCreatedAt.textContent = "Just now / Recently";
    }
}

// API Key Masking & Actions
function updateApiKeyDisplay() {
    if (isApiKeyVisible) {
        displayApiKey.textContent = currentRawApiKey;
        toggleApiKeyVisibilityBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    } else {
        displayApiKey.textContent = '•'.repeat(Math.min(currentRawApiKey.length || 16, 24));
        toggleApiKeyVisibilityBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    }
}

toggleApiKeyVisibilityBtn.addEventListener('click', () => {
    isApiKeyVisible = !isApiKeyVisible;
    updateApiKeyDisplay();
});

copyApiKeyBtn.addEventListener('click', async () => {
    if (!currentRawApiKey) return;
    try {
        await navigator.clipboard.writeText(currentRawApiKey);
        showToast('API key copied to clipboard', 'success');
    } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Failed to copy API key', 'error');
    }
});

// ==========================================
// MODAL CONTROLS (ADD / EDIT)
// ==========================================
let modalMode = 'add'; 

function openAddModal() {
    modalMode = 'add';
    currentApiDocId = null;
    modalTitle.textContent = "Add ImgBB API";
    modalApiKeyInput.value = "";
    modalEmail.value = currentUser.email;
    modalError.classList.add('hidden');
    apiKeyModal.classList.remove('hidden');
    apiKeyModal.setAttribute('aria-hidden', 'false');
    modalApiKeyInput.focus();
}

function openEditModal() {
    modalMode = 'edit';
    modalTitle.textContent = "Edit ImgBB API";
    modalApiKeyInput.value = currentRawApiKey;
    modalEmail.value = currentUser.email;
    modalError.classList.add('hidden');
    apiKeyModal.classList.remove('hidden');
    apiKeyModal.setAttribute('aria-hidden', 'false');
    modalApiKeyInput.focus();
}

async function openOwnerEditModal(docId) {
    modalMode = 'edit';
    modalTitle.textContent = "Edit Document (Owner)";
    currentApiDocId = docId;
    modalError.classList.add('hidden');

    try {
        const docRef = doc(db, "imgbb_api", docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            modalApiKeyInput.value = data.apiKey || "";
            modalEmail.value = data.email || currentUser.email;
            apiKeyModal.classList.remove('hidden');
            apiKeyModal.setAttribute('aria-hidden', 'false');
        }
    } catch (err) {
        console.error("Error fetching doc for owner edit:", err);
        showToast("Failed to fetch document details.", "error");
    }
}

function closeModal() {
    apiKeyModal.classList.add('hidden');
    apiKeyModal.setAttribute('aria-hidden', 'true');
    apiKeyForm.reset();
}

addKeyBtn.addEventListener('click', openAddModal);
editKeyBtn.addEventListener('click', openEditModal);
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);

apiKeyModal.addEventListener('click', (e) => {
    if (e.target === apiKeyModal) closeModal();
});

toggleModalApiKeyBtn.addEventListener('click', () => {
    const type = modalApiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    modalApiKeyInput.setAttribute('type', type);
});

// Form Submission (Add or Update)
apiKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    modalError.classList.add('hidden');

    const enteredApiKey = modalApiKeyInput.value.trim();
    if (!enteredApiKey) {
        showModalError('API key is required.');
        return;
    }

    setLoading(saveApiKeyBtn, true, 'Saving...');

    try {
        if (modalMode === 'add') {
            const q = query(collection(db, "imgbb_api"), where("uid", "==", currentUser.uid));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                showToast('ImgBB API already configured for this account.', 'error');
                closeModal();
                loadUserApiConfiguration();
                return;
            }

            await addDoc(collection(db, "imgbb_api"), {
                name: "imgbb",
                apiKey: enteredApiKey,
                email: currentUser.email,
                uid: currentUser.uid,
                createdAt: serverTimestamp()
            });

            showToast('API key saved successfully', 'success');
        } else {
            if (!currentApiDocId) {
                throw new Error('No active document found to update.');
            }

            const docRef = doc(db, "imgbb_api", currentApiDocId);
            await updateDoc(docRef, {
                apiKey: enteredApiKey
            });

            showToast('API key updated successfully', 'success');
        }

        closeModal();
        loadUserApiConfiguration();
    } catch (error) {
        console.error('Save/Update error:', error);
        showModalError(error.message || 'Operation failed. Please check permissions.');
    } finally {
        setLoading(saveApiKeyBtn, false, 'Save Changes');
    }
});

function showModalError(message) {
    modalError.textContent = message;
    modalError.classList.remove('hidden');
}

// ==========================================
// DELETE HANDLER
// ==========================================
deleteKeyBtn.addEventListener('click', () => {
    targetDocIdToDelete = currentApiDocId;
    deleteModal.classList.remove('hidden');
    deleteModal.setAttribute('aria-hidden', 'false');
});

function closeDeleteModal() {
    deleteModal.classList.add('hidden');
    deleteModal.setAttribute('aria-hidden', 'true');
    targetDocIdToDelete = null;
}

cancelDeleteBtn.addEventListener('click', closeDeleteModal);
deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
});

confirmDeleteBtn.addEventListener('click', async () => {
    if (!targetDocIdToDelete) {
        closeDeleteModal();
        return;
    }

    setLoading(confirmDeleteBtn, true, 'Deleting...');

    try {
        const docRef = doc(db, "imgbb_api", targetDocIdToDelete);
        await deleteDoc(docRef);

        showToast('API key deleted successfully', 'success');
        closeDeleteModal();
        loadUserApiConfiguration();
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Failed to delete API key. Permission denied or network error.', 'error');
    } finally {
        setLoading(confirmDeleteBtn, false, 'Delete');
    }
});

// ==========================================
// UTILITY HELPERS
// ==========================================
function setLoading(buttonEl, isLoading, text) {
    const textSpan = buttonEl.querySelector('.btn-text');
    const spinner = buttonEl.querySelector('.spinner');

    if (isLoading) {
        buttonEl.disabled = true;
        if (textSpan) textSpan.classList.add('hidden');
        if (spinner) spinner.classList.remove('hidden');
    } else {
        buttonEl.disabled = false;
        if (textSpan) {
            textSpan.textContent = text;
            textSpan.classList.remove('hidden');
        }
        if (spinner) spinner.classList.add('hidden');
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeDeleteModal();
    }
});
