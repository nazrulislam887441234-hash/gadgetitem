import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, startAfter, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// State Management Variables
let currentRole = "";
let imgbbApiKey = null;
let lastVisibleDoc = null;
let allCategoriesCache = [];
let filteredCategoriesCache = [];
let isSearching = false;
let currentEditingId = null;
let pendingDeleteId = null;
let selectedFile = null;
let uploadedImageUrl = "";
let hasMoreCategories = true;

// DOM Elements
const authLoader = document.getElementById("auth-loader");
const unauthorizedScreen = document.getElementById("unauthorized-screen");
const appContainer = document.getElementById("app-container");
const missingApiModal = document.getElementById("missing-api-modal");
const userRoleBadge = document.getElementById("user-role-badge");
const userEmailDisplay = document.getElementById("user-email-display");
const logoutBtn = document.getElementById("logout-btn");
const backToLoginBtn = document.getElementById("back-to-login-btn");
const configureImgbbBtn = document.getElementById("configure-imgbb-btn");
const categoriesGrid = document.getElementById("categories-grid");
const emptyState = document.getElementById("empty-state");
const categoryCount = document.getElementById("category-count");
const loadMoreContainer = document.getElementById("load-more-container");
const loadMoreBtn = document.getElementById("load-more-btn");
const noMoreText = document.getElementById("no-more-text");
const searchInput = document.getElementById("search-input");
const openCreateModalBtn = document.getElementById("open-create-modal-btn");
const categoryModal = document.getElementById("category-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const cancelModalBtn = document.getElementById("cancel-modal-btn");
const categoryForm = document.getElementById("category-form");
const modalTitle = document.getElementById("modal-title");
const categoryIdInput = document.getElementById("category-id-input");
const categoryNameInput = document.getElementById("category-name");
const categorySlugInput = document.getElementById("category-slug");
const categoryImageFile = document.getElementById("category-image-file");
const dropZone = document.getElementById("drop-zone");
const fileLabelText = document.getElementById("file-label-text");
const imagePreviewContainer = document.getElementById("image-preview-container");
const imagePreview = document.getElementById("image-preview");
const previewFilename = document.getElementById("preview-filename");
const uploadStatusText = document.getElementById("upload-status-text");
const removeImageBtn = document.getElementById("remove-image-btn");
const saveCategoryBtn = document.getElementById("save-category-btn");
const saveBtnText = document.getElementById("save-btn-text");
const deleteModal = document.getElementById("delete-modal");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const toastContainer = document.getElementById("toast-container");

// Initialize Authentication Flow
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "admin-login.html";
        return;
    }

    const email = user.email;

    if (email === OWNER_EMAIL) {
        currentRole = "owner";
        grantAccess();
        return;
    }

    try {
        const adminDocRef = doc(db, "admins", email);
        const adminDocSnap = await getDoc(adminDocRef);

        if (adminDocSnap.exists() && adminDocSnap.data().active === true) {
            currentRole = "admin";
            grantAccess();
        } else {
            denyAccess();
        }
    } catch (error) {
        console.error("Authentication verification error:", error);
        denyAccess();
    }
});

function grantAccess() {
    authLoader.classList.add("hidden");
    appContainer.classList.remove("hidden");
    userRoleBadge.textContent = currentRole.toUpperCase();
    userEmailDisplay.textContent = auth.currentUser.email;

    // Check ImgBB API Configuration and load categories
    checkImgbbApiConfig();
    loadCategories(true);
}

function denyAccess() {
    authLoader.classList.add("hidden");
    unauthorizedScreen.classList.remove("hidden");
}

backToLoginBtn.addEventListener("click", () => {
    window.location.href = "admin-login.html";
});

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "admin-login.html";
    } catch (error) {
        showToast("Error signing out.", "error");
    }
});

// ImgBB API Validation Check
async function checkImgbbApiConfig() {
    try {
        const imgbbCollection = collection(db, "imgbb_api");
        const q = query(imgbbCollection, limit(10));
        const querySnapshot = await getDocs(q);

        let validConfigFound = false;
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.apiKey && data.email && data.uid) {
                imgbbApiKey = data.apiKey;
                validConfigFound = true;
            }
        });

        if (!validConfigFound) {
            missingApiModal.classList.remove("hidden");
        }
    } catch (error) {
        console.error("Error checking ImgBB API configuration:", error);
        missingApiModal.classList.remove("hidden");
    }
}

configureImgbbBtn.addEventListener("click", () => {
    window.location.href = "imgbb-api.html";
});

// Slug Generator Utility
function generateSlug(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-");
}

categoryNameInput.addEventListener("input", (e) => {
    // Only auto-generate if we are creating or if slug hasn't been manually fine-tuned differently
    if (!currentEditingId) {
        categorySlugInput.value = generateSlug(e.target.value);
    }
});

// File Upload & Preview Logic
dropZone.addEventListener("click", () => categoryImageFile.click());

categoryImageFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
        showToast("Please select a valid image file (JPG, JPEG, PNG, WEBP).", "error");
        return;
    }

    // Validate file size (e.g., max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast("Image file size must be less than 5MB.", "error");
        return;
    }

    selectedFile = file;
    fileLabelText.textContent = file.name;
    previewFilename.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (event) => {
        imagePreview.src = event.target.result;
        imagePreviewContainer.classList.remove("hidden");
        dropZone.classList.add("hidden");
    };
    reader.readAsDataURL(file);
});

removeImageBtn.addEventListener("click", () => {
    selectedFile = null;
    categoryImageFile.value = "";
    imagePreview.src = "";
    imagePreviewContainer.classList.add("hidden");
    dropZone.classList.remove("hidden");
    fileLabelText.textContent = "Choose an image or drag it here";
    if (currentEditingId) {
        // Keep existing image URL unless user explicitly removes/replaces
    }
});

// ImgBB Upload Function
async function uploadToImgBB(file) {
    if (!imgbbApiKey) {
        throw new Error("ImgBB API key is missing.");
    }

    const formData = new FormData();
    formData.append("image", file);

    uploadStatusText.textContent = "Uploading to ImgBB...";

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
        method: "POST",
        body: formData
    });

    const data = await response.json();
    if (data && data.success) {
        uploadStatusText.textContent = "Image uploaded successfully.";
        showToast("Image uploaded successfully.", "success");
        return data.data.url;
    } else {
        throw new Error(data.error?.message || "Failed to upload image to ImgBB.");
    }
}

// Load Categories with Pagination (limit 20)
async function loadCategories(isInitial = false) {
    try {
        if (isInitial) {
            categoriesGrid.innerHTML = `
                <div class="category-card-skeleton"></div>
                <div class="category-card-skeleton"></div>
                <div class="category-card-skeleton"></div>
                <div class="category-card-skeleton"></div>
            `;
            allCategoriesCache = [];
            lastVisibleDoc = null;
        }

        const categoriesRef = collection(db, "categories");
        let q;

        if (lastVisibleDoc && !isInitial) {
            q = query(categoriesRef, orderBy("createdAt", "desc"), startAfter(lastVisibleDoc), limit(20));
        } else {
            q = query(categoriesRef, orderBy("createdAt", "desc"), limit(20));
        }

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty && isInitial) {
            categoriesGrid.innerHTML = "";
            emptyState.classList.remove("hidden");
            loadMoreContainer.classList.add("hidden");
            categoryCount.textContent = "0 items";
            return;
        }

        emptyState.classList.add("hidden");
        let fetchedDocs = [];
        querySnapshot.forEach((docSnap) => {
            fetchedDocs.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (querySnapshot.docs.length > 0) {
            lastVisibleDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        }

        if (querySnapshot.docs.length < 20) {
            hasMoreCategories = false;
            loadMoreBtn.classList.add("hidden");
            noMoreText.classList.remove("hidden");
            loadMoreContainer.classList.remove("hidden");
        } else {
            hasMoreCategories = true;
            loadMoreBtn.classList.remove("hidden");
            noMoreText.classList.add("hidden");
            loadMoreContainer.classList.remove("hidden");
        }

        if (isInitial) {
            allCategoriesCache = fetchedDocs;
        } else {
            allCategoriesCache = [...allCategoriesCache, ...fetchedDocs];
        }

        renderCategories(allCategoriesCache);
        categoryCount.textContent = `${allCategoriesCache.length} items loaded`;

    } catch (error) {
        console.error("Error loading categories:", error);
        showToast("Failed to load categories.", "error");
    }
}

loadMoreBtn.addEventListener("click", () => {
    if (!hasMoreCategories) return;
    loadMoreBtn.textContent = "Loading...";
    loadMoreBtn.disabled = true;
    loadCategories(false).then(() => {
        loadMoreBtn.textContent = "Load More";
        loadMoreBtn.disabled = false;
    });
});

// Render Categories Grid
function renderCategories(categoriesList) {
    if (categoriesList.length === 0) {
        categoriesGrid.innerHTML = "";
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    categoriesGrid.innerHTML = "";

    categoriesList.forEach((cat) => {
        const formattedDate = cat.createdAt && cat.createdAt.toDate 
            ? cat.createdAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "Recently";

        const card = document.createElement("div");
        card.className = "category-card";
        card.innerHTML = `
            <div class="category-card-img-wrap">
                <img src="${cat.categoryImage || 'https://store.ghotimarket.com/amrweb/website-logo.png'}" alt="${cat.categoryName}" loading="lazy">
            </div>
            <div class="category-card-body">
                <div>
                    <h4 class="category-title">${escapeHtml(cat.categoryName)}</h4>
                    <span class="category-slug">${escapeHtml(cat.categorySlug)}</span>
                </div>
                <div class="category-meta">
                    <span class="category-date">${formattedDate}</span>
                    <div class="category-actions">
                        <button class="btn-icon edit-btn" data-id="${cat.id}" title="Edit Category">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="btn-icon danger delete-btn" data-id="${cat.id}" title="Delete Category">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        categoriesGrid.appendChild(card);
    });

    // Attach Event Listeners to dynamic buttons
    document.querySelectorAll(".edit-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => openEditModal(e.currentTarget.getAttribute("data-id")));
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => openDeleteModal(e.currentTarget.getAttribute("data-id")));
    });
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Search Functionality
searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!term) {
        isSearching = false;
        renderCategories(allCategoriesCache);
        categoryCount.textContent = `${allCategoriesCache.length} items loaded`;
        return;
    }

    isSearching = true;
    filteredCategoriesCache = allCategoriesCache.filter(cat => 
        (cat.categoryName && cat.categoryName.toLowerCase().includes(term)) ||
        (cat.categorySlug && cat.categorySlug.toLowerCase().includes(term))
    );

    renderCategories(filteredCategoriesCache);
    categoryCount.textContent = `${filteredCategoriesCache.length} results found`;
});

// Modal Open/Close Controls
openCreateModalBtn.addEventListener("click", () => {
    if (!imgbbApiKey) {
        showToast("ImgBB API configuration is missing.", "error");
        missingApiModal.classList.remove("hidden");
        return;
    }
    currentEditingId = null;
    modalTitle.textContent = "Create Category";
    saveBtnText.textContent = "Save Category";
    categoryForm.reset();
    categoryIdInput.value = "";
    selectedFile = null;
    uploadedImageUrl = "";
    imagePreview.src = "";
    imagePreviewContainer.classList.add("hidden");
    dropZone.classList.remove("hidden");
    fileLabelText.textContent = "Choose an image or drag it here";
    categoryModal.classList.remove("hidden");
});

closeModalBtn.addEventListener("click", () => categoryModal.classList.add("hidden"));
cancelModalBtn.addEventListener("click", () => categoryModal.classList.add("hidden"));

// Open Edit Modal
function openEditModal(id) {
    const category = allCategoriesCache.find(cat => cat.id === id);
    if (!category) return;

    currentEditingId = id;
    modalTitle.textContent = "Edit Category";
    saveBtnText.textContent = "Update Category";
    categoryIdInput.value = category.id;
    categoryNameInput.value = category.categoryName || "";
    categorySlugInput.value = category.categorySlug || "";
    uploadedImageUrl = category.categoryImage || "";

    if (category.categoryImage) {
        imagePreview.src = category.categoryImage;
        previewFilename.textContent = "Current Image";
        imagePreviewContainer.classList.remove("hidden");
        dropZone.classList.add("hidden");
    } else {
        selectedFile = null;
        imagePreview.src = "";
        imagePreviewContainer.classList.add("hidden");
        dropZone.classList.remove("hidden");
    }

    categoryModal.classList.remove("hidden");
}

// Duplicate Slug Checking Utility
async function checkSlugExists(slug, excludeId = null) {
    const categoriesRef = collection(db, "categories");
    const querySnapshot = await getDocs(categoriesRef);
    let exists = false;
    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.categorySlug === slug && docSnap.id !== excludeId) {
            exists = true;
        }
    });
    return exists;
}

// Form Submission (Create & Update)
categoryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const categoryName = categoryNameInput.value.trim();
    const categorySlug = generateSlug(categorySlugInput.value.trim());

    if (!categoryName || !categorySlug) {
        showToast("Please fill in all required fields.", "error");
        return;
    }

    if (!currentEditingId && !selectedFile) {
        showToast("Please select a category image.", "error");
        return;
    }

    saveCategoryBtn.disabled = true;
    saveBtnText.textContent = currentEditingId ? "Updating..." : "Creating...";

    try {
        // Check duplicate slug
        const slugExists = await checkSlugExists(categorySlug, currentEditingId);
        if (slugExists) {
            showToast("This category slug already exists. Please use another slug.", "error");
            saveCategoryBtn.disabled = false;
            saveBtnText.textContent = currentEditingId ? "Update Category" : "Save Category";
            return;
        }

        // Handle image upload if a new file is selected
        if (selectedFile) {
            uploadedImageUrl = await uploadToImgBB(selectedFile);
        }

        if (!uploadedImageUrl) {
            throw new Error("Category image is required.");
        }

        if (currentEditingId) {
            // Update Category (preserve createdAt)
            const docRef = doc(db, "categories", currentEditingId);
            await updateDoc(docRef, {
                categoryName,
                categorySlug,
                categoryImage: uploadedImageUrl
            });

            showToast("Category updated successfully.", "success");
        } else {
            // Create Category
            await addDoc(collection(db, "categories"), {
                categoryName,
                categorySlug,
                categoryImage: uploadedImageUrl,
                createdAt: serverTimestamp()
            });

            showToast("Category created successfully.", "success");
        }

        categoryModal.classList.add("hidden");
        loadCategories(true);

    } catch (error) {
        console.error("Error saving category:", error);
        showToast(error.message || "Failed to save category.", "error");
    } finally {
        saveCategoryBtn.disabled = false;
        saveBtnText.textContent = currentEditingId ? "Update Category" : "Save Category";
    }
});

// Delete Modal Controls
function openDeleteModal(id) {
    pendingDeleteId = id;
    deleteModal.classList.remove("hidden");
}

cancelDeleteBtn.addEventListener("click", () => {
    pendingDeleteId = null;
    deleteModal.classList.add("hidden");
});

confirmDeleteBtn.addEventListener("click", async () => {
    if (!pendingDeleteId) return;

    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = "Deleting...";

    try {
        await deleteDoc(doc(db, "categories", pendingDeleteId));
        showToast("Category deleted successfully.", "success");
        deleteModal.classList.add("hidden");
        pendingDeleteId = null;
        loadCategories(true);
    } catch (error) {
        console.error("Error deleting category:", error);
        showToast("Failed to delete category.", "error");
    } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = "Delete Category";
    }
});

// Toast Notification System
function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    let svgIcon = "";
    if (type === "success") {
        svgIcon = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === "error") {
        svgIcon = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
        svgIcon = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    }

    toast.innerHTML = `
        ${svgIcon}
        <span class="toast-message">${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "fadeOut 0.3s ease-in forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
