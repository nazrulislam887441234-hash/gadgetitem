import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const db = getFirestore(app);
const auth = getAuth(app);

// Fallback banner constant
const FALLBACK_IMAGE = "https://ghotimarket.com/amrweb/banner1.png";

document.addEventListener("DOMContentLoaded", () => {
    initializePage();
});

function initializePage() {
    setupAuthObserver();
}

function setupAuthObserver() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "/login";
            return;
        }
        
        await Promise.all([
            loadCartBadge(user.uid),
            loadUserOrders(user)
        ]);
    });
}

async function loadCartBadge(uid) {
    try {
        const cartRef = doc(db, "carts", uid);
        const cartSnap = await getDoc(cartRef);
        let count = 0;
        
        if (cartSnap.exists()) {
            const cartData = cartSnap.data();
            if (Array.isArray(cartData.items)) {
                count = cartData.items.length;
            }
        }
        
        const badgeEl = document.getElementById("giCartBadge");
        if (badgeEl) {
            badgeEl.textContent = count;
        }
    } catch (error) {
        console.error("Error loading cart count:", error);
    }
}

async function loadUserOrders(user) {
    const container = document.getElementById("giOrdersContainer");
    if (!container) return;

    try {
        let orders = [];
        
        // Attempt ordered query first
        try {
            const qOrdered = query(
                collection(db, "orders"),
                where("uid", "==", user.uid),
                orderBy("createdAt", "desc")
            );
            const querySnapshot = await getDocs(qOrdered);
            querySnapshot.forEach((docSnap) => {
                orders.push({ id: docSnap.id, ...docSnap.data() });
            });
        } catch (indexError) {
            // Fallback query if composite index is building/missing
            console.warn("Compound index query fallback active:", indexError);
            const qFallback = query(
                collection(db, "orders"),
                where("uid", "==", user.uid)
            );
            const fallbackSnapshot = await getDocs(qFallback);
            fallbackSnapshot.forEach((docSnap) => {
                orders.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Client-side sort fallback
            orders.sort((a, b) => {
                const timeA = extractTimestampMillis(a.createdAt);
                const timeB = extractTimestampMillis(b.createdAt);
                return timeB - timeA;
            });
        }

        renderOrders(orders);
    } catch (error) {
        console.error("Failed to load user orders:", error);
        showErrorState(container);
    }
}

function extractTimestampMillis(createdAt) {
    if (!createdAt) return 0;
    if (typeof createdAt.toDate === "function") {
        return createdAt.toDate().getTime();
    }
    if (typeof createdAt.seconds === "number") {
        return createdAt.seconds * 1000;
    }
    const parsed = new Date(createdAt).getTime();
    return isNaN(parsed) ? 0 : parsed;
}

function formatFirestoreDate(createdAt) {
    const millis = extractTimestampMillis(createdAt);
    if (!millis) return "Recent Date";
    
    const dateObj = new Date(millis);
    return dateObj.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }) + ", " + dateObj.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function formatBDT(value) {
    const amount = Number(value) || 0;
    return `৳${amount.toLocaleString("en-BD")}`;
}

function formatOrderStatus(rawStatus) {
    const normalized = String(rawStatus || "pending").toLowerCase().trim();
    const formatted = normalized.replace(/_/g, " ");
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getStatusIconSVG(normalizedStatus) {
    switch (normalizedStatus) {
        case "pending":
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
        case "confirmed":
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
        case "processing":
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
        case "shipped":
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
        case "delivered":
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
        case "cancelled":
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
        case "returned":
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`;
        default:
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    }
}

function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderOrders(orders) {
    const container = document.getElementById("giOrdersContainer");
    if (!container) return;

    if (!orders || orders.length === 0) {
        showEmptyState(container);
        return;
    }

    const fragment = document.createDocumentFragment();
    orders.forEach(order => {
        const card = renderOrderCard(order);
        fragment.appendChild(card);
    });

    container.innerHTML = "";
    container.appendChild(fragment);
}

function renderOrderCard(order) {
    const card = document.createElement("article");
    card.className = "gi-order-card";

    const orderId = escapeHTML(order.id);
    const dateFormatted = formatFirestoreDate(order.createdAt);
    const rawStatus = String(order.status || "pending").toLowerCase().trim();
    const statusClass = `status-${rawStatus}`;
    const statusLabel = formatOrderStatus(rawStatus);
    const statusIcon = getStatusIconSVG(rawStatus);
    
    const items = Array.isArray(order.orderItems) ? order.orderItems : [];
    const itemCount = items.length;
    const grandTotalFormatted = formatBDT(order.grandTotal);

    card.innerHTML = `
        <div class="gi-order-summary-header">
            <div class="gi-order-meta-group">
                <span class="gi-order-id-label">Order #${orderId}</span>
                <span class="gi-order-date">${escapeHTML(dateFormatted)}</span>
            </div>
            <div class="gi-order-info-stats">
                <span class="gi-order-status ${escapeHTML(statusClass)}">
                    ${statusIcon}
                    <span>${escapeHTML(statusLabel)}</span>
                </span>
                <span class="gi-order-items-count">${itemCount} Item${itemCount > 1 ? 's' : ''}</span>
                <span class="gi-order-grand-total">${grandTotalFormatted}</span>
                <button type="button" class="gi-order-toggle-btn" aria-expanded="false">
                    <span>View Order Details</span>
                    <svg class="gi-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
            </div>
        </div>
        <div class="gi-order-details-body">
            <div class="gi-order-items-list">
                ${renderOrderItems(items)}
            </div>
            <div class="gi-order-meta-split">
                <div class="gi-subcard">
                    <h3 class="gi-subcard-title">Order Summary</h3>
                    ${renderOrderSummary(order)}
                </div>
                <div class="gi-subcard">
                    <h3 class="gi-subcard-title">Delivery Information</h3>
                    ${renderCustomerInformation(order)}
                </div>
            </div>
        </div>
    `;

    const toggleBtn = card.querySelector(".gi-order-toggle-btn");
    toggleBtn.addEventListener("click", () => {
        const isExpanded = card.classList.toggle("expanded");
        toggleBtn.setAttribute("aria-expanded", isExpanded);
    });

    return card;
}

function renderOrderItems(items) {
    if (!items.length) return `<p>No products found for this order.</p>`;

    return items.map(item => {
        const name = escapeHTML(item.productName || "Product");
        const sku = escapeHTML(item.SKU || "-");
        const qty = Number(item.quantity) || 1;
        const unitPrice = formatBDT(item.unitPrice);
        const totalPrice = formatBDT(item.totalPrice);
        const imgSrc = item.productImage && item.productImage.trim() !== "" ? item.productImage : FALLBACK_IMAGE;
        const productSlug = item.productSlug ? escapeHTML(item.productSlug) : "";
        
        const isFreeDelivery = item.freeDelivery === true;
        const deliveryBadgeHTML = isFreeDelivery
            ? `<div class="gi-item-delivery-badge gi-delivery-free">Free Delivery</div>`
            : `<div class="gi-item-delivery-badge gi-delivery-charge">Delivery Charge Applicable</div>`;

        return `
            <div class="gi-order-item-row">
                <div class="gi-item-image-wrap">
                    <img src="${escapeHTML(imgSrc)}" alt="${name}" class="gi-item-image" loading="lazy" onerror="this.src='${FALLBACK_IMAGE}'" onclick="if('${productSlug}') { window.location.href='/product?${productSlug}'; }">
                </div>
                <div class="gi-item-content">
                    <a class="gi-item-name" ${productSlug ? `href="/product?${productSlug}"` : ""}>${name}</a>
                    <span class="gi-item-sku">SKU: ${sku}</span>
                    <div class="gi-item-variants">
                        ${renderSelectedVariants(item.selectedVariants)}
                    </div>
                    ${deliveryBadgeHTML}
                </div>
                <div class="gi-item-pricing-meta">
                    <span class="gi-item-qty-price">Qty: ${qty} × ${unitPrice}</span>
                    <span class="gi-item-total-price">${totalPrice}</span>
                </div>
            </div>
        `;
    }).join("");
}

function renderSelectedVariants(variants) {
    if (!variants || typeof variants !== "object" || Object.keys(variants).length === 0) {
        return "";
    }

    return Object.entries(variants).map(([key, data]) => {
        const valName = escapeHTML(data?.value || "");
        const extraPrice = Number(data?.extraPrice) || 0;
        const extraText = extraPrice > 0 ? ` +${formatBDT(extraPrice)}` : "";
        
        return `<span class="gi-variant-tag">${escapeHTML(key)}: ${valName}${extraText}</span>`;
    }).join("");
}

function renderOrderSummary(order) {
    const subtotal = formatBDT(order.subtotal);
    const discountNum = Number(order.discount) || 0;
    const discountFormatted = discountNum > 0 ? `-${formatBDT(discountNum)}` : formatBDT(0);
    const deliveryCharge = formatBDT(order.deliveryCharge);
    const grandTotal = formatBDT(order.grandTotal);
    
    const promoCode = order.appliedPromoCode ? escapeHTML(order.appliedPromoCode) : "";

    return `
        <div class="gi-summary-row">
            <span>Subtotal</span>
            <span>${subtotal}</span>
        </div>
        <div class="gi-summary-row">
            <span>Discount</span>
            <span>${discountFormatted}</span>
        </div>
        <div class="gi-summary-row">
            <span>Delivery Charge</span>
            <span>${deliveryCharge}</span>
        </div>
        <div class="gi-summary-row gi-grand-total">
            <span>Grand Total</span>
            <span>${grandTotal}</span>
        </div>
        ${promoCode ? `<div class="gi-promo-code-badge">Promo Code: ${promoCode}</div>` : ""}
    `;
}

function renderCustomerInformation(order) {
    const customerName = escapeHTML(order.customerName || "N/A");
    const phone = escapeHTML(order.phone || "N/A");
    const email = escapeHTML(order.email || "N/A");
    const deliveryArea = escapeHTML(order.deliveryArea || "N/A");
    
    const thanaVal = escapeHTML(order.thanaUpazila || order.thana || "N/A");
    const district = escapeHTML(order.district || "N/A");
    const division = escapeHTML(order.division || "N/A");
    const addressVal = escapeHTML(order.fullAddress || order.address || "N/A");

    return `
        <div class="gi-customer-info-list">
            <div class="gi-info-row">
                <span class="gi-info-label">Customer Name</span>
                <span class="gi-info-value">${customerName}</span>
            </div>
            <div class="gi-info-row">
                <span class="gi-info-label">Phone</span>
                <span class="gi-info-value">${phone}</span>
            </div>
            <div class="gi-info-row">
                <span class="gi-info-label">Email</span>
                <span class="gi-info-value">${email}</span>
            </div>
            <div class="gi-info-row">
                <span class="gi-info-label">Delivery Area</span>
                <span class="gi-info-value">${deliveryArea}</span>
            </div>
            <div class="gi-info-row">
                <span class="gi-info-label">Thana / Upazila</span>
                <span class="gi-info-value">${thanaVal}</span>
            </div>
            <div class="gi-info-row">
                <span class="gi-info-label">District</span>
                <span class="gi-info-value">${district}</span>
            </div>
            <div class="gi-info-row">
                <span class="gi-info-label">Division</span>
                <span class="gi-info-value">${division}</span>
            </div>
            <div class="gi-info-row">
                <span class="gi-info-label">Address</span>
                <span class="gi-info-value">${addressVal}</span>
            </div>
        </div>
    `;
}

function showEmptyState(container) {
    container.innerHTML = `
        <div class="gi-empty-state">
            <svg class="gi-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            <h2 class="gi-empty-title">No Orders Yet</h2>
            <p class="gi-empty-text">You haven't placed any orders yet. Start shopping and your orders will appear here.</p>
            <a href="/all-product" class="gi-btn-primary">Start Shopping</a>
        </div>
    `;
}

function showErrorState(container) {
    container.innerHTML = `
        <div class="gi-error-state">
            <svg class="gi-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h2 class="gi-error-title">Unable to Load Orders</h2>
            <p class="gi-error-text">Something went wrong while loading your orders. Please try again.</p>
            <button type="button" class="gi-btn-primary" onclick="window.location.reload()">Try Again</button>
        </div>
    `;
}
