// Import Firebase modular SDKs compatible with Firebase 10.8.0
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc 
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


// Initialize Firebase App & Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Global App State
let currentUser = null;
let cartItems = [];
let itemPendingDeletion = null;
let activeVariantEditItem = null;
let currentProductFetchedForVariant = null;
let selectedVariantsDraft = {};

// DOM Elements
const headerCartBadge = document.getElementById("headerCartBadge");
const mobileCartBadge = document.getElementById("mobileCartBadge");
const headerAuthBtn = document.getElementById("headerAuthBtn");
const headerAuthText = document.getElementById("headerAuthText");

const loginRequiredState = document.getElementById("loginRequiredState");
const errorState = document.getElementById("errorState");
const emptyCartState = document.getElementById("emptyCartState");
const loadingState = document.getElementById("loadingState");
const cartContentWrapper = document.getElementById("cartContentWrapper");

const loginPromptBtn = document.getElementById("loginPromptBtn");
const retryCartBtn = document.getElementById("retryCartBtn");
const cartItemsList = document.getElementById("cartItemsList");
const cartItemCountHeader = document.getElementById("cartItemCountHeader");

const summaryTotalProducts = document.getElementById("summaryTotalProducts");
const summaryTotalQuantity = document.getElementById("summaryTotalQuantity");
const summarySubtotal = document.getElementById("summarySubtotal");
const summaryGrandTotal = document.getElementById("summaryGrandTotal");
const checkoutBtn = document.getElementById("checkoutBtn");

// Modals
const loginModal = document.getElementById("loginModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalGoogleLoginBtn = document.getElementById("modalGoogleLoginBtn");
const modalLoadingIndicator = document.getElementById("modalLoadingIndicator");
const modalErrorMsg = document.getElementById("modalErrorMsg");

const deleteModal = document.getElementById("deleteModal");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

const variantModal = document.getElementById("variantModal");
const closeVariantModalBtn = document.getElementById("closeVariantModalBtn");
const variantEditorContainer = document.getElementById("variantEditorContainer");
const cancelVariantBtn = document.getElementById("cancelVariantBtn");
const saveVariantBtn = document.getElementById("saveVariantBtn");

const toastContainer = document.getElementById("toastContainer");
const currentYearSpan = document.getElementById("currentYear");

// Initialize page execution
document.addEventListener("DOMContentLoaded", () => {
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }
    setupEventListeners();
    initAuthListener();
});

// Setup UI Event Listeners
function setupEventListeners() {
    // Header Auth Button
    headerAuthBtn.addEventListener("click", () => {
        if (!currentUser) {
            openLoginModal();
        } else {
            // Navigate to profile or allow sign out if needed
            window.location.href = "/profile";
        }
    });

    // Login prompt buttons
    loginPromptBtn.addEventListener("click", openLoginModal);
    closeModalBtn.addEventListener("click", closeLoginModal);
    modalGoogleLoginBtn.addEventListener("click", handleGoogleLogin);

    // Close modals on backdrop click
    window.addEventListener("click", (e) => {
        if (e.target === loginModal) closeLoginModal();
        if (e.target === deleteModal) closeDeleteModal();
        if (e.target === variantModal) closeVariantModal();
    });

    // Retry button
    retryCartBtn.addEventListener("click", () => {
        if (currentUser) loadUserCart(currentUser.uid);
    });

    // Delete modal buttons
    cancelDeleteBtn.addEventListener("click", closeDeleteModal);
    confirmDeleteBtn.addEventListener("click", confirmDeleteProduct);

    // Variant modal buttons
    closeVariantModalBtn.addEventListener("click", closeVariantModal);
    cancelVariantBtn.addEventListener("click", closeVariantModal);
    saveVariantBtn.addEventListener("click", saveUpdatedVariant);

    // Checkout button
    checkoutBtn.addEventListener("click", () => {
        if (!currentUser) {
            openLoginModal();
            return;
        }
        if (cartItems.length === 0) {
            showToast("Your cart is empty", "error");
            return;
        }
        window.location.href = "/checkout";
    });
}

// Authentication State Listener
function initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            updateHeaderAuthUI(user);
            await loadUserCart(user.uid);
        } else {
            updateHeaderAuthUI(null);
            showLoginRequiredState();
        }
    });
}

function updateHeaderAuthUI(user) {
    if (user) {
        headerAuthText.textContent = user.displayName ? user.displayName.split(" ")[0] : "Account";
    } else {
        headerAuthText.textContent = "Sign In";
    }
}

// Google Login Flow
function openLoginModal() {
    loginModal.classList.remove("hidden");
    loginModal.setAttribute("aria-hidden", "false");
    modalErrorMsg.classList.add("hidden");
    modalLoadingIndicator.classList.add("hidden");
}

function closeLoginModal() {
    loginModal.classList.add("hidden");
    loginModal.setAttribute("aria-hidden", "true");
}

async function handleGoogleLogin() {
    modalLoadingIndicator.classList.remove("hidden");
    modalErrorMsg.classList.add("hidden");
    try {
        const result = await signInWithPopup(auth, googleProvider);
        currentUser = result.user;
        closeLoginModal();
        showToast("Successfully signed in!", "success");
        updateHeaderAuthUI(currentUser);
        await loadUserCart(currentUser.uid);
        
        // If user came via checkout trigger
        if (checkoutBtn.dataset.pendingCheckout === "true") {
            checkoutBtn.dataset.pendingCheckout = "false";
            window.location.href = "/checkout";
        }
    } catch (error) {
        console.error("Login error:", error);
        if (error.code !== "auth/popup-closed-by-user") {
            modalErrorMsg.textContent = "Authentication failed. Please try again.";
            modalErrorMsg.classList.remove("hidden");
        }
    } finally {
        modalLoadingIndicator.classList.add("hidden");
    }
}

// Load Cart Data from Firestore
async function loadUserCart(uid) {
    showLoadingState();
    try {
        const cartDocRef = doc(db, "carts", uid);
        const cartSnap = await getDoc(cartDocRef);

        if (cartSnap.exists()) {
            const data = cartSnap.data();
            cartItems = Array.isArray(data.items) ? data.items : [];
        } else {
            cartItems = [];
        }

        updateCartBadges();
        renderCartContent();
    } catch (error) {
        console.error("Error loading cart:", error);
        showErrorState();
    }
}

// Render Cart Content Based on items length
function renderCartContent() {
    loadingState.classList.add("hidden");
    loginRequiredState.classList.add("hidden");
    errorState.classList.add("hidden");

    if (cartItems.length === 0) {
        emptyCartState.classList.remove("hidden");
        cartContentWrapper.classList.add("hidden");
        return;
    }

    emptyCartState.classList.add("hidden");
    cartContentWrapper.classList.remove("hidden");
    cartItemCountHeader.textContent = cartItems.length;

    // Render individual item cards safely
    cartItemsList.innerHTML = "";
    cartItems.forEach((item, index) => {
        const card = createCartItemCard(item, index);
        cartItemsList.appendChild(card);
    });

    updateOrderSummary();
}

// Build Cart Item Card Element safely to avoid XSS
function createCartItemCard(item, index) {
    const card = document.createElement("div");
    card.className = "cart-item-card";
    card.dataset.index = index;
    card.dataset.productId = item.productId;

    // Image fallback handling
    const imgSrc = (item.productImage && item.productImage.trim() !== "") 
        ? item.productImage 
        : "https://ghotimarket.com/amrweb/banner1.png";

    // Format variants safely
    let variantsHTML = "";
    if (item.selectedVariants && typeof item.selectedVariants === "object") {
        const variantEntries = Object.entries(item.selectedVariants);
        if (variantEntries.length > 0) {
            let tags = variantEntries.map(([key, val]) => {
                const valStr = typeof val === "object" && val !== null ? val.value : val;
                const extra = typeof val === "object" && val !== null && val.extraPrice ? ` (+৳${Number(val.extraPrice).toLocaleString()})` : "";
                return `<span class="variant-tag"><strong>${escapeHTML(key)}:</strong> ${escapeHTML(String(valStr))}${extra}</span>`;
            }).join("");

            variantsHTML = `
                <div class="cart-item-variants">
                    ${tags}
                </div>
                <button class="change-variant-link" data-index="${index}">Change Variant</button>
            `;
        }
    }

    const skuHTML = item.SKU ? `<div class="cart-item-sku">SKU: ${escapeHTML(item.SKU)}</div>` : "";
    const unitPriceFormatted = Number(item.unitPrice || 0).toLocaleString();
    const totalPriceFormatted = Number(item.totalPrice || 0).toLocaleString();

    card.innerHTML = `
        <div class="cart-item-img-wrap">
            <img src="${escapeHTML(imgSrc)}" alt="${escapeHTML(item.productName || 'Product')}" class="cart-item-img" onerror="this.src='https://ghotimarket.com/amrweb/banner1.png'">
        </div>
        <div class="cart-item-details">
            <h3 class="cart-item-name">${escapeHTML(item.productName || 'Unnamed Product')}</h3>
            ${skuHTML}
            ${variantsHTML}
            <div class="cart-item-pricing-row">
                <span class="unit-price-display">Unit Price: ৳${unitPriceFormatted}</span>
                <span class="total-price-display">৳${totalPriceFormatted}</span>
            </div>
            <div class="cart-item-actions-row">
                <div class="quantity-controls">
                    <button class="qty-btn decrease-qty" data-index="${index}" aria-label="Decrease quantity">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <span class="qty-display">${item.quantity || 1}</span>
                    <button class="qty-btn increase-qty" data-index="${index}" aria-label="Increase quantity">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                </div>
                <button class="delete-item-btn" data-index="${index}" aria-label="Remove item">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Remove
                </button>
            </div>
        </div>
    `;

    // Attach local element listeners
    const decreaseBtn = card.querySelector(".decrease-qty");
    const increaseBtn = card.querySelector(".increase-qty");
    const deleteBtn = card.querySelector(".delete-item-btn");
    const changeVarBtn = card.querySelector(".change-variant-link");

    decreaseBtn.addEventListener("click", () => updateItemQuantity(index, -1));
    increaseBtn.addEventListener("click", () => updateItemQuantity(index, 1));
    deleteBtn.addEventListener("click", () => promptDeleteProduct(index));
    if (changeVarBtn) {
        changeVarBtn.addEventListener("click", () => openVariantModal(index));
    }

    return card;
}

// Helper to escape HTML text for security
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Quantity Control Handling
async function updateItemQuantity(index, change) {
    const item = cartItems[index];
    if (!item) return;

    let newQty = (item.quantity || 1) + change;
    if (newQty < 1) newQty = 1;

    if (newQty === item.quantity) return; // No change

    item.quantity = newQty;
    item.totalPrice = item.unitPrice * newQty;

    // Optimistic UI update or quick re-render
    renderCartContent();
    showToast("Quantity updated", "success");

    // Save to Firestore asynchronously
    await saveCartToFirestore();
}

// Delete Product Flow
function promptDeleteProduct(index) {
    itemPendingDeletion = index;
    deleteModal.classList.remove("hidden");
    deleteModal.setAttribute("aria-hidden", "false");
}

function closeDeleteModal() {
    itemPendingDeletion = null;
    deleteModal.classList.add("hidden");
    deleteModal.setAttribute("aria-hidden", "true");
}

async function confirmDeleteProduct() {
    if (itemPendingDeletion === null) return;

    cartItems.splice(itemPendingDeletion, 1);
    closeDeleteModal();
    
    updateCartBadges();
    renderCartContent();
    showToast("Product removed from cart", "success");

    await saveCartToFirestore();
}

// Variant Modification Feature
async function openVariantModal(index) {
    const item = cartItems[index];
    if (!item || !item.productId) return;

    activeVariantEditItem = { index, item };
    variantEditorContainer.innerHTML = `<div class="modal-loading"><div class="spinner"></div><span>Loading variants...</span></div>`;
    variantModal.classList.remove("hidden");
    variantModal.setAttribute("aria-hidden", "false");

    try {
        const productRef = doc(db, "products", item.productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
            variantEditorContainer.innerHTML = `<p class="modal-error">This product is no longer available.</p>`;
            return;
        }

        currentProductFetchedForVariant = productSnap.data();
        
        if (!currentProductFetchedForVariant.variants || !Array.isArray(currentProductFetchedForVariant.variants) || currentProductFetchedForVariant.variants.length === 0) {
            variantEditorContainer.innerHTML = `<p>No configurable variants available for this product.</p>`;
            return;
        }

        // Initialize draft selected variants from current item selection
        selectedVariantsDraft = JSON.parse(JSON.stringify(item.selectedVariants || {}));
        renderVariantEditorGroups(currentProductFetchedForVariant.variants);

    } catch (err) {
        console.error("Error fetching product variants:", err);
        variantEditorContainer.innerHTML = `<p class="modal-error">Failed to load product details.</p>`;
    }
}

function closeVariantModal() {
    variantModal.classList.add("hidden");
    variantModal.setAttribute("aria-hidden", "true");
    activeVariantEditItem = null;
    currentProductFetchedForVariant = null;
    selectedVariantsDraft = {};
}

function renderVariantEditorGroups(variantsArray) {
    variantEditorContainer.innerHTML = "";

    variantsArray.forEach(group => {
        const groupDiv = document.createElement("div");
        groupDiv.className = "variant-group-wrapper";

        const title = document.createElement("div");
        title.className = "variant-group-title";
        title.textContent = group.groupName || "Option";
        groupDiv.appendChild(title);

        const optionsGrid = document.createElement("div");
        optionsGrid.className = "variant-options-grid";

        if (Array.isArray(group.options)) {
            group.options.forEach(opt => {
                const chip = document.createElement("button");
                chip.type = "button";
                const optName = opt.name || opt.value;
                const extraP = opt.extraPrice || 0;

                chip.className = `variant-option-chip`;
                // Check if currently selected
                const currentSelection = selectedVariantsDraft[group.groupName];
                if (currentSelection && currentSelection.value === optName) {
                    chip.classList.add("selected");
                }

                chip.textContent = extraP > 0 ? `${optName} (+৳${extraP})` : optName;

                chip.addEventListener("click", () => {
                    // Update draft selection
                    selectedVariantsDraft[group.groupName] = {
                        value: optName,
                        extraPrice: Number(extraP)
                    };
                    // Re-render chips for this group
                    renderVariantEditorGroups(variantsArray);
                });

                optionsGrid.appendChild(chip);
            });
        }

        groupDiv.appendChild(optionsGrid);
        variantEditorContainer.appendChild(groupDiv);
    });
}

async function saveUpdatedVariant() {
    if (!activeVariantEditItem || !currentProductFetchedForVariant) return;

    const { index, item } = activeVariantEditItem;

    // Recalculate base price + variant extra prices
    const basePrice = Number(currentProductFetchedForVariant.productPrice || currentProductFetchedForVariant.basePrice || item.unitPrice);
    let totalExtraPrice = 0;

    Object.values(selectedVariantsDraft).forEach(valObj => {
        if (valObj && typeof valObj.extraPrice === "number") {
            totalExtraPrice += valObj.extraPrice;
        }
    });

    const newUnitPrice = basePrice + totalExtraPrice;

    // Update item data
    item.selectedVariants = selectedVariantsDraft;
    item.unitPrice = newUnitPrice;
    item.totalPrice = newUnitPrice * item.quantity;
    item.productName = currentProductFetchedForVariant.productName || item.productName;
    if (currentProductFetchedForVariant.productImage && currentProductFetchedForVariant.productImage[0]) {
        item.productImage = currentProductFetchedForVariant.productImage[0];
    }

    closeVariantModal();
    renderCartContent();
    showToast("Variant updated successfully", "success");

    await saveCartToFirestore();
}

// Order Summary Calculations
function updateOrderSummary() {
    let totalProductsCount = cartItems.length;
    let totalQty = 0;
    let subtotalAmount = 0;

    cartItems.forEach(item => {
        const qty = Number(item.quantity) || 1;
        const uPrice = Number(item.unitPrice) || 0;
        totalQty += qty;
        subtotalAmount += (uPrice * qty);
    });

    summaryTotalProducts.textContent = totalProductsCount;
    summaryTotalQuantity.textContent = totalQty;
    summarySubtotal.textContent = `৳${subtotalAmount.toLocaleString()}`;
    summaryGrandTotal.textContent = `৳${subtotalAmount.toLocaleString()}`;
}

// Update Cart Badges across header and mobile nav
function updateCartBadges() {
    let totalQty = 0;
    cartItems.forEach(item => {
        totalQty += Number(item.quantity) || 1;
    });

    if (headerCartBadge) headerCartBadge.textContent = totalQty;
    if (mobileCartBadge) mobileCartBadge.textContent = totalQty;
}

// Save Cart back to Firestore safely preserving uid and email
async function saveCartToFirestore() {
    if (!currentUser) return;

    try {
        const cartDocRef = doc(db, "carts", currentUser.uid);
        await setDoc(cartDocRef, {
            uid: currentUser.uid,
            email: currentUser.email || "",
            updatedAt: new Date().toISOString(),
            items: cartItems
        }, { merge: true });
    } catch (err) {
        console.error("Error saving cart to Firestore:", err);
        showToast("Unable to update cart. Please try again.", "error");
    }
}

// UI State Switchers
function showLoadingState() {
    loadingState.classList.remove("hidden");
    cartContentWrapper.classList.add("hidden");
    loginRequiredState.classList.add("hidden");
    errorState.classList.add("hidden");
    emptyCartState.classList.add("hidden");
}

function showLoginRequiredState() {
    loadingState.classList.add("hidden");
    cartContentWrapper.classList.add("hidden");
    errorState.classList.add("hidden");
    emptyCartState.classList.add("hidden");
    loginRequiredState.classList.remove("hidden");
}

function showErrorState() {
    loadingState.classList.add("hidden");
    cartContentWrapper.classList.add("hidden");
    loginRequiredState.classList.add("hidden");
    emptyCartState.classList.add("hidden");
    errorState.classList.remove("hidden");
}

// Custom Toast Notification System
function showToast(message, type = "success") {
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    let iconSVG = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    if (type === "error") {
        iconSVG = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    }

    toast.innerHTML = `
        ${iconSVG}
        <span>${escapeHTML(message)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(20px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
