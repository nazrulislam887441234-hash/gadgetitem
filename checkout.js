import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    deleteDoc, 
    collection, 
    addDoc, 
    serverTimestamp 
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

// State Variables
let currentUser = null;
let cartData = { items: [], block: false };
let appliedPromo = null;
let deliveryArea = null; // 'inside' or 'outside'
let isSubmitting = false;

// DOM Elements
const cartBadgeEl = document.getElementById("gi-cart-badge");
const alertContainerEl = document.getElementById("gi-alert-container");
const blockedStateEl = document.getElementById("gi-blocked-state");
const emptyCartStateEl = document.getElementById("gi-empty-cart-state");
const checkoutContentEl = document.getElementById("gi-checkout-content");
const cartItemsContainerEl = document.getElementById("gi-cart-items-container");
const confirmOrderBtnEl = document.getElementById("gi-confirm-order-btn");
const successModalEl = document.getElementById("gi-success-modal");

// Summary Elements
const sumSubtotalEl = document.getElementById("gi-sum-subtotal");
const sumDiscountContainerEl = document.getElementById("gi-discount-container");
const appliedCodeLabelEl = document.getElementById("gi-applied-code-label");
const sumDiscountEl = document.getElementById("gi-sum-discount");
const sumDeliveryEl = document.getElementById("gi-sum-delivery");
const sumGrandTotalEl = document.getElementById("gi-sum-grandtotal");

// Promo Elements
const promoInputEl = document.getElementById("gi-promo-input");
const applyPromoBtnEl = document.getElementById("gi-apply-promo-btn");
const promoFeedbackEl = document.getElementById("gi-promo-feedback");

// Form Elements
const orderFormEl = document.getElementById("gi-order-form");
const fullNameEl = document.getElementById("gi-fullname");
const phoneEl = document.getElementById("gi-phone");
const thanaEl = document.getElementById("gi-thana");
const districtEl = document.getElementById("gi-district");
const divisionEl = document.getElementById("gi-division");
const addressEl = document.getElementById("gi-address");

// Utility: Format currency in BDT/TK
function formatTK(amount) {
    return `৳${Number(amount).toLocaleString('en-IN')}`;
}

// Utility: Show Global Alerts
function showAlert(message, type = "error") {
    alertContainerEl.textContent = message;
    alertContainerEl.className = `gi-alert-container gi-alert-${type}`;
    alertContainerEl.style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideAlert() {
    alertContainerEl.style.display = "none";
}

// Authentication & Initialization Guard
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login";
        return;
    }
    currentUser = user;
    await loadCartData();
});

// Load Cart Data from Firestore
async function loadCartData() {
    try {
        const cartRef = doc(db, "carts", currentUser.uid);
        const cartSnap = await getDoc(cartRef);

        if (!cartSnap.exists()) {
            renderEmptyState();
            updateCartBadge(0);
            return;
        }

        cartData = cartSnap.data();
        
        // Check Account Block Status
        if (cartData.block === true) {
            renderBlockedState();
            updateCartBadge(cartData.items ? cartData.items.length : 0);
            return;
        }

        if (!cartData.items || cartData.items.length === 0) {
            renderEmptyState();
            updateCartBadge(0);
            return;
        }

        renderCartBadge();
        renderActiveCheckout();
    } catch (error) {
        console.error("Error loading cart:", error);
        showAlert("Failed to load your cart. Please try refreshing.", "error");
    }
}

function updateCartBadge(count) {
    if (cartBadgeEl) cartBadgeEl.textContent = count;
}

function renderCartBadge() {
    const count = cartData.items ? cartData.items.length : 0;
    updateCartBadge(count);
}

function renderEmptyState() {
    blockedStateEl.style.display = "none";
    checkoutContentEl.style.display = "none";
    emptyCartStateEl.style.display = "block";
}

function renderBlockedState() {
    emptyCartStateEl.style.display = "none";
    checkoutContentEl.style.display = "none";
    blockedStateEl.style.display = "block";
}

function renderActiveCheckout() {
    emptyCartStateEl.style.display = "none";
    blockedStateEl.style.display = "none";
    checkoutContentEl.style.display = "grid";

    renderCartItemsList();
    calculateTotals();
}

// Render Cart Items List with Controls
function renderCartItemsList() {
    cartItemsContainerEl.innerHTML = "";

    cartData.items.forEach((item, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "gi-checkout-item";

        // Format selected variants string
        let variantsText = "";
        if (item.selectedVariants && typeof item.selectedVariants === 'object') {
            const variantEntries = Object.entries(item.selectedVariants);
            if (variantEntries.length > 0) {
                variantsText = variantEntries.map(([k, v]) => `${k}: ${v}`).join(" | ");
            }
        }

        itemDiv.innerHTML = `
            <img src="${item.productImage || 'https://store.ghotimarket.com/amrweb/website-logo.png'}" alt="${item.productName}" class="gi-item-image">
            <div class="gi-item-details">
                <a href="/product/${item.productSlug || '#'}" class="gi-item-name">${item.productName}</a>
                <div class="gi-item-meta">SKU: ${item.SKU || 'N/A'}</div>
                ${variantsText ? `<div class="gi-item-variants">${variantsText}</div>` : ''}
                <div class="gi-item-pricing-info">
                    Unit Price: ${formatTK(item.unitPrice)} | Total: <strong>${formatTK(item.totalPrice)}</strong>
                </div>
                ${item.freeDelivery ? `<div class="gi-free-delivery-badge">Free Delivery</div>` : ''}
                <div class="gi-item-controls">
                    <div class="gi-qty-group">
                        <button type="button" class="gi-qty-btn gi-decrease-qty" data-index="${index}">-</button>
                        <span class="gi-qty-display">${item.quantity}</span>
                        <button type="button" class="gi-qty-btn gi-increase-qty" data-index="${index}">+</button>
                    </div>
                    <button type="button" class="gi-remove-btn gi-remove-item" data-index="${index}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Remove
                    </button>
                </div>
            </div>
        `;
        cartItemsContainerEl.appendChild(itemDiv);
    });

    attachItemEventListeners();
}

// Attach Event Listeners for Quantity and Removal
function attachItemEventListeners() {
    document.querySelectorAll(".gi-increase-qty").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const index = parseInt(e.target.getAttribute("data-index"));
            modifyQuantity(index, 1);
        });
    });

    document.querySelectorAll(".gi-decrease-qty").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const index = parseInt(e.target.getAttribute("data-index"));
            modifyQuantity(index, -1);
        });
    });

    document.querySelectorAll(".gi-remove-item").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const index = parseInt(e.currentTarget.getAttribute("data-index"));
            removeItem(index);
        });
    });
}

// Modify Item Quantity & Persist to Firestore
async function modifyQuantity(index, change) {
    const item = cartData.items[index];
    const newQty = item.quantity + change;
    
    if (newQty < 1) return;

    item.quantity = newQty;
    item.totalPrice = item.unitPrice * newQty;

    await persistCartUpdate();
}

// Remove Individual Product
async function removeItem(index) {
    cartData.items.splice(index, 1);
    await persistCartUpdate();
}

async function persistCartUpdate() {
    try {
        const cartRef = doc(db, "carts", currentUser.uid);
        
        if (cartData.items.length === 0) {
            await deleteDoc(cartRef);
            renderEmptyState();
            updateCartBadge(0);
            return;
        }

        cartData.updatedAt = new Date().toISOString();
        await setDoc(cartRef, cartData);

        renderCartBadge();
        renderCartItemsList();
        calculateTotals();
        
        // Revalidate Promo Code against Subtotal limit if applied
        if (appliedPromo) {
            validatePromoAgainstSubtotal();
        }
    } catch (error) {
        console.error("Error updating cart:", error);
        showAlert("Failed to update cart. Please try again.", "error");
    }
}

// Delivery Location Selection Event Listeners
document.querySelectorAll('input[name="deliveryLocation"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
        deliveryArea = e.target.value;
        calculateTotals();
        validateFormCompletion();
    });
});

// Calculate Pricing & Breakdown
function calculateTotals() {
    let subtotal = 0;
    cartData.items.forEach(item => {
        subtotal += item.totalPrice;
    });

    // Delivery charge calculation: PER PRODUCT, NOT quantity
    let deliveryCharge = 0;
    if (deliveryArea) {
        const feePerProduct = deliveryArea === 'inside' ? 60 : 120;
        cartData.items.forEach(item => {
            if (!item.freeDelivery) {
                deliveryCharge += feePerProduct;
            }
        });
    }

    // Discount Calculation
    let discountAmount = 0;
    if (appliedPromo) {
        discountAmount = Number(appliedPromo.Discount) || 0;
        if (discountAmount > subtotal) {
            discountAmount = subtotal; // Cannot discount more than subtotal
        }
    }

    const grandTotal = (subtotal - discountAmount) + deliveryCharge;

    // Update UI Summary Box
    sumSubtotalEl.textContent = formatTK(subtotal);
    
    if (appliedPromo && discountAmount > 0) {
        sumDiscountContainerEl.style.display = "flex";
        appliedCodeLabelEl.textContent = appliedPromo.code;
        sumDiscountEl.textContent = `-` + formatTK(discountAmount);
    } else {
        sumDiscountContainerEl.style.display = "none";
    }

    sumDeliveryEl.textContent = formatTK(deliveryCharge);
    sumGrandTotalEl.textContent = formatTK(grandTotal);

    return { subtotal, deliveryCharge, discountAmount, grandTotal };
}

// Promo Code Verification & Validation
applyPromoBtnEl.addEventListener("click", async () => {
    const rawCode = promoInputEl.value;
    if (!rawCode || !rawCode.trim()) {
        setPromoFeedback("Please enter a promo code.", "error");
        return;
    }

    const enteredCode = rawCode.trim();

    // Prevent duplicate application
    if (appliedPromo && appliedPromo.code === enteredCode) {
        setPromoFeedback("This promo code is already applied.", "error");
        return;
    }

    try {
        applyPromoBtnEl.disabled = true;
        setPromoFeedback("Validating promo code...", "success");

        const promoRef = doc(db, "promoCode", enteredCode);
        const promoSnap = await getDoc(promoRef);

        if (!promoSnap.exists()) {
            setPromoFeedback("Invalid promo code.", "error");
            applyPromoBtnEl.disabled = false;
            return;
        }

        const promoData = promoSnap.data();
        const currentTime = Date.now();

        if (promoData.active !== true) {
            setPromoFeedback("Promo code inactive.", "error");
            applyPromoBtnEl.disabled = false;
            return;
        }

        if (Number(promoData.expired) <= currentTime) {
            setPromoFeedback("Promo code expired.", "error");
            applyPromoBtnEl.disabled = false;
            return;
        }

        const discountVal = Number(promoData.Discount);
        if (isNaN(discountVal) || discountVal <= 0) {
            setPromoFeedback("Invalid promo code configuration.", "error");
            applyPromoBtnEl.disabled = false;
            return;
        }

        // Calculate product subtotal for shoppingLimit check
        let subtotal = 0;
        cartData.items.forEach(item => { subtotal += item.totalPrice; });

        const shoppingLimit = Number(promoData.shoppingLimit) || 0;
        if (subtotal < shoppingLimit) {
            setPromoFeedback(`Minimum shopping amount not reached (${formatTK(shoppingLimit)} required).`, "error");
            applyPromoBtnEl.disabled = false;
            return;
        }

        // Apply Promo Successfully
        appliedPromo = {
            code: enteredCode,
            Discount: discountVal,
            shoppingLimit: shoppingLimit
        };

        setPromoFeedback("Promo code applied successfully!", "success");
        calculateTotals();
        applyPromoBtnEl.disabled = false;

    } catch (error) {
        console.error("Error validating promo:", error);
        setPromoFeedback("Error validating promo code. Try again.", "error");
        applyPromoBtnEl.disabled = false;
    }
});

function setPromoFeedback(msg, type) {
    promoFeedbackEl.textContent = msg;
    promoFeedbackEl.className = `gi-promo-feedback ${type}`;
}

function validatePromoAgainstSubtotal() {
    if (!appliedPromo) return;
    let subtotal = 0;
    cartData.items.forEach(item => { subtotal += item.totalPrice; });

    if (subtotal < appliedPromo.shoppingLimit) {
        appliedPromo = null;
        sumDiscountContainerEl.style.display = "none";
        setPromoFeedback("Promo removed because subtotal fell below shopping limit.", "error");
        calculateTotals();
    }
}

// Form Validation Listeners
[fullNameEl, phoneEl, thanaEl, districtEl, divisionEl, addressEl].forEach(element => {
    element.addEventListener("input", validateFormCompletion);
});

function validateFormCompletion() {
    const isLocationSelected = deliveryArea !== null;
    const isNameValid = fullNameEl.value.trim() !== "";
    const isPhoneValid = phoneEl.value.trim() !== "";
    const isThanaValid = thanaEl.value.trim() !== "";
    const isDistrictValid = districtEl.value.trim() !== "";
    const isDivisionValid = divisionEl.value.trim() !== "";
    const isAddressValid = addressEl.value.trim() !== "";

    const formComplete = isLocationSelected && isNameValid && isPhoneValid && isThanaValid && isDistrictValid && isDivisionValid && isAddressValid;

    confirmOrderBtnEl.disabled = !formComplete || isSubmitting;
}

// Order Creation Flow & Submission Guard
confirmOrderBtnEl.addEventListener("click", async () => {
    if (isSubmitting) return;

    // Validate inputs one last time
    if (!deliveryArea) {
        showAlert("Please select a delivery location.", "error");
        return;
    }

    if (!fullNameEl.value.trim() || !phoneEl.value.trim() || !thanaEl.value.trim() || !districtEl.value.trim() || !divisionEl.value.trim() || !addressEl.value.trim()) {
        showAlert("Please fill in all required shipping address fields.", "error");
        return;
    }

    try {
        isSubmitting = true;
        confirmOrderBtnEl.disabled = true;
        confirmOrderBtnEl.textContent = "Processing Order...";
        hideAlert();

        // 1. Check Authentication Again
        if (!auth.currentUser) {
            window.location.href = "/login";
            return;
        }

        const activeUid = auth.currentUser.uid;

        // 2. Fetch and check carts/{uid} again from Firestore
        const cartRef = doc(db, "carts", activeUid);
        const cartSnap = await getDoc(cartRef);

        if (!cartSnap.exists()) {
            showAlert("Your cart is empty.", "error");
            renderEmptyState();
            return;
        }

        const latestCartData = cartSnap.data();

        // 3. Check Block Status
        if (latestCartData.block === true) {
            renderBlockedState();
            return;
        }

        if (!latestCartData.items || latestCartData.items.length === 0) {
            showAlert("Your cart is empty.", "error");
            renderEmptyState();
            return;
        }

        // 4. Recalculate totals securely from latest cart data
        let subtotal = 0;
        latestCartData.items.forEach(item => { subtotal += item.totalPrice; });

        let deliveryCharge = 0;
        const feePerProduct = deliveryArea === 'inside' ? 60 : 120;
        latestCartData.items.forEach(item => {
            if (!item.freeDelivery) {
                deliveryCharge += feePerProduct;
            }
        });

        // 5. Revalidate Promo Code if applied
        let discountAmount = 0;
        let finalAppliedCode = null;

        if (appliedPromo) {
            const promoRef = doc(db, "promoCode", appliedPromo.code);
            const promoSnap = await getDoc(promoRef);

            if (promoSnap.exists()) {
                const promoData = promoSnap.data();
                const currentTime = Date.now();

                if (promoData.active === true && Number(promoData.expired) > currentTime && subtotal >= (Number(promoData.shoppingLimit) || 0)) {
                    discountAmount = Number(promoData.Discount) || 0;
                    if (discountAmount > subtotal) discountAmount = subtotal;
                    finalAppliedCode = appliedPromo.code;
                }
            }
        }

        const grandTotal = (subtotal - discountAmount) + deliveryCharge;

        // 6. Create Order Document in 'orders' collection
        const orderPayload = {
            uid: activeUid,
            email: currentUser.email || "",
            customerName: fullNameEl.value.trim(),
            phone: phoneEl.value.trim(),
            thanaUpazila: thanaEl.value.trim(),
            district: districtEl.value.trim(),
            division: divisionEl.value.trim(),
            fullAddress: addressEl.value.trim(),
            deliveryArea: deliveryArea,
            deliveryCharge: deliveryCharge,
            subtotal: subtotal,
            discount: discountAmount,
            grandTotal: grandTotal,
            appliedPromoCode: finalAppliedCode,
            orderItems: latestCartData.items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                productSlug: item.productSlug || "",
                productImage: item.productImage || "",
                productPrice: item.productPrice,
                selectedVariants: item.selectedVariants || {},
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                SKU: item.SKU || "",
                categoryId: item.categoryId || "",
                freeDelivery: !!item.freeDelivery
            })),
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        const ordersRef = collection(db, "orders");
        await addDoc(ordersRef, orderPayload);

        // 7. Delete ONLY the current user's cart document after successful order
        await deleteDoc(cartRef);

        // 8. Show professional success state and redirect
        successModalEl.style.display = "flex";

        setTimeout(() => {
            window.location.href = "/my-order";
        }, 2000);

    } catch (error) {
        console.error("Order submission error:", error);
        showAlert("An error occurred while placing your order. Please try again.", "error");
        isSubmitting = false;
        confirmOrderBtnEl.disabled = false;
        confirmOrderBtnEl.textContent = "Confirm Order";
    }
});
