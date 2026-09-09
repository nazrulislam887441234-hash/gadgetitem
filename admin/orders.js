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
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let allOrdersData = [];
let customerBlockMap = {};
let lastVisibleDoc = null;
let hasMoreData = true;
let isFetching = false;
let currentSearchQuery = "";
let currentStatusFilter = "all";
let currentBlockFilter = "all";
let currentSelectedOrder = null;

const authLoadingScreen = document.getElementById("auth-loading-screen");
const adminLayout = document.getElementById("admin-layout");
const userEmailDisplay = document.getElementById("user-email-display");
const roleBadgeEl = document.getElementById("role-badge-el");
const ownerNavLink = document.getElementById("owner-nav-link");
const logoutBtn = document.getElementById("logout-btn");

const ordersTableBody = document.getElementById("orders-table-body");
const emptyState = document.getElementById("empty-state");
const errorState = document.getElementById("error-state");
const errorMessageText = document.getElementById("error-message-text");
const retryFetchBtn = document.getElementById("retry-fetch-btn");
const loadMoreContainer = document.getElementById("load-more-container");
const loadMoreBtn = document.getElementById("load-more-btn");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const blockFilter = document.getElementById("block-filter");

const statTotal = document.getElementById("stat-total");
const statPending = document.getElementById("stat-pending");
const statConfirmed = document.getElementById("stat-confirmed");
const statDelivered = document.getElementById("stat-delivered");
const statCancelled = document.getElementById("stat-cancelled");
const statCustomers = document.getElementById("stat-customers");
const statBlocked = document.getElementById("stat-blocked");

const orderDrawer = document.getElementById("order-drawer");
const drawerCloseBtn = document.getElementById("drawer-close-btn");
const drawerCloseActionBtn = document.getElementById("drawer-close-action-btn");
const drawerOrderIdBadge = document.getElementById("drawer-order-id-badge");
const drawerBodyContent = document.getElementById("drawer-body-content");
const drawerSaveOrderBtn = document.getElementById("drawer-save-order-btn");

const confirmDeleteModal = document.getElementById("confirm-delete-modal");
const deleteTargetId = document.getElementById("delete-target-id");
const confirmDeleteCancelBtn = document.getElementById("confirm-delete-cancel-btn");
const confirmDeleteProceedBtn = document.getElementById("confirm-delete-proceed-btn");
let orderToDeleteId = null;

const appToast = document.getElementById("app-toast");
const toastMsg = document.getElementById("toast-msg");

// Robust Clipboard Utility supporting both HTTP and HTTPS
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        let textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        return new Promise((resolve, reject) => {
            try {
                document.execCommand('copy');
                textArea.remove();
                resolve();
            } catch (err) {
                textArea.remove();
                reject(err);
            }
        });
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/login");
        return;
    }
    const email = user.email;
    let hasAccess = false;
    if (email === OWNER_EMAIL) {
        hasAccess = true;
        roleBadgeEl.textContent = "Owner";
        roleBadgeEl.className = "role-badge owner";
        ownerNavLink.style.display = "flex";
    } else {
        try {
            const adminDocRef = doc(db, "admins", email);
            const adminSnap = await getDoc(adminDocRef);
            if (adminSnap.exists() && adminSnap.data().active === true) {
                hasAccess = true;
                roleBadgeEl.textContent = "Admin";
                roleBadgeEl.className = "role-badge admin";
            }
        } catch (err) {
            console.error("Admin verification lookup error:", err);
        }
    }
    if (!hasAccess) {
        await signOut(auth);
        window.location.replace("/login");
        return;
    }
    userEmailDisplay.textContent = email;
    authLoadingScreen.style.display = "none";
    adminLayout.style.display = "flex";
    loadOrdersFirstBatch();
});

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.replace("/login");
    } catch (err) {
        showToast("Error signing out.");
    }
});

async function loadOrdersFirstBatch() {
    if (isFetching) return;
    isFetching = true;
    hideStates();
    try {
        allOrdersData = [];
        customerBlockMap = {};
        lastVisibleDoc = null;
        hasMoreData = true;
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            renderOrdersList();
            updateStatistics();
            isFetching = false;
            return;
        }
        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        const uidsToFetch = new Set();
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            allOrdersData.push({ id: docSnap.id, ...data });
            if (data.uid) uidsToFetch.add(data.uid);
        });
        await fetchCustomerBlocks(uidsToFetch);
        if (snapshot.docs.length < PAGE_SIZE) {
            hasMoreData = false;
        }
        renderOrdersList();
        updateStatistics();
    } catch (err) {
        console.error("Error loading orders:", err);
        showErrorState(err.message);
    } finally {
        isFetching = false;
    }
}

async function loadMoreOrdersBatch() {
    if (isFetching || !hasMoreData) return;
    isFetching = true;
    loadMoreBtn.textContent = "Loading...";
    try {
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, orderBy("createdAt", "desc"), startAfter(lastVisibleDoc), limit(PAGE_SIZE));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            hasMoreData = false;
            loadMoreContainer.style.display = "none";
            isFetching = false;
            return;
        }
        lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        const uidsToFetch = new Set();
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            allOrdersData.push({ id: docSnap.id, ...data });
            if (data.uid) uidsToFetch.add(data.uid);
        });
        await fetchCustomerBlocks(uidsToFetch);
        if (snapshot.docs.length < PAGE_SIZE) {
            hasMoreData = false;
        }
        renderOrdersList();
        updateStatistics();
    } catch (err) {
        console.error("Error loading more orders:", err);
        showToast("Failed to load additional records.");
    } finally {
        isFetching = false;
        loadMoreBtn.textContent = "Load More Orders";
    }
}

async function fetchCustomerBlocks(uids) {
    for (const uid of uids) {
        if (customerBlockMap[uid] !== undefined) continue;
        try {
            const cartSnap = await getDoc(doc(db, "carts", uid));
            if (cartSnap.exists()) {
                const cartData = cartSnap.data();
                customerBlockMap[uid] = cartData.block === true;
            } else {
                customerBlockMap[uid] = false;
            }
        } catch (e) {
            customerBlockMap[uid] = false;
        }
    }
}

loadMoreBtn.addEventListener("click", loadMoreOrdersBatch);
retryFetchBtn.addEventListener("click", loadOrdersFirstBatch);

searchInput.addEventListener("input", (e) => {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    renderOrdersList();
});
statusFilter.addEventListener("change", (e) => {
    currentStatusFilter = e.target.value;
    renderOrdersList();
});
blockFilter.addEventListener("change", (e) => {
    currentBlockFilter = e.target.value;
    renderOrdersList();
});

function renderOrdersList() {
    let filtered = allOrdersData;
    if (currentSearchQuery) {
        filtered = filtered.filter(o => {
            return (
                o.id.toLowerCase().includes(currentSearchQuery) ||
                (o.email && o.email.toLowerCase().includes(currentSearchQuery)) ||
                (o.uid && o.uid.toLowerCase().includes(currentSearchQuery)) ||
                (o.customerName && o.customerName.toLowerCase().includes(currentSearchQuery)) ||
                (o.phone && o.phone.toLowerCase().includes(currentSearchQuery))
            );
        });
    }
    if (currentStatusFilter !== "all") {
        filtered = filtered.filter(o => o.status === currentStatusFilter);
    }
    if (currentBlockFilter !== "all") {
        const isBlockedTarget = currentBlockFilter === "blocked";
        filtered = filtered.filter(o => customerBlockMap[o.uid] === isBlockedTarget);
    }
    ordersTableBody.innerHTML = "";
    if (allOrdersData.length === 0 || filtered.length === 0) {
        emptyState.style.display = "flex";
        loadMoreContainer.style.display = "none";
        return;
    }
    emptyState.style.display = "none";
    filtered.forEach(order => {
        const tr = document.createElement("tr");
        const statusClass = order.status ? order.status.toLowerCase() : "pending";
        const statusBadge = `<span class="badge ${statusClass}">${escapeHTML(order.status || "Pending")}</span>`;
        const dateStr = order.createdAt && order.createdAt.seconds
          ? new Date(order.createdAt.seconds * 1000).toLocaleDateString()
          : "Recent";
        const isBlocked = customerBlockMap[order.uid] === true;
        const itemCount = order.orderItems ? order.orderItems.length : (order.items ? order.items.length : 0);
        
        tr.innerHTML = `
            <td><strong>#${escapeHTML(order.id.slice(0, 8))}</strong><br><small class="text-muted">${dateStr}</small></td>
            <td><strong>${escapeHTML(order.customerName || order.name || "N/A")}</strong><br><small class="text-muted">${escapeHTML(order.email || "No email")} | ${escapeHTML(order.phone || "No phone")}</small></td>
            <td>${escapeHTML(order.district || order.deliveryLocation || "Standard")}, ${escapeHTML(order.division || "")}</td>
            <td><strong>BDT ${(order.grandTotal || order.total || 0).toLocaleString()}</strong><br><small class="text-muted">${itemCount} items</small></td>
            <td>${statusBadge}</td>
            <td><label class="switch-label" onclick="event.stopPropagation()"><input type="checkbox" class="block-toggle-input" data-uid="${escapeHTML(order.uid || "")}" ${isBlocked ? "checked" : ""}><span class="slider-toggle"></span></label></td>
            <td class="text-right">
                <div class="action-cell">
                    <button class="action-icon-btn view-action" data-id="${escapeHTML(order.id)}" title="View Order Details"><svg class="action-icon" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg></button>
                    <button class="action-icon-btn delete-action" data-id="${escapeHTML(order.id)}" title="Delete Order"><svg class="action-icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
                </div>
            </td>
        `;
        tr.addEventListener("click", () => openOrderDrawer(order.id));
        ordersTableBody.appendChild(tr);
    });

    document.querySelectorAll(".block-toggle-input").forEach(input => {
        input.addEventListener("change", async (e) => {
            const uid = e.target.getAttribute("data-uid");
            const blockState = e.target.checked;
            await toggleCustomerBlockStatus(uid, blockState);
        });
    });

    document.querySelectorAll(".view-action").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            openOrderDrawer(e.currentTarget.getAttribute("data-id"));
        });
    });

    document.querySelectorAll(".delete-action").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            openDeleteModal(e.currentTarget.getAttribute("data-id"));
        });
    });

    if (hasMoreData && !currentSearchQuery && currentStatusFilter === "all" && currentBlockFilter === "all") {
        loadMoreContainer.style.display = "block";
    } else {
        loadMoreContainer.style.display = "none";
    }
}

function updateStatistics() {
    let total = allOrdersData.length;
    let pending = allOrdersData.filter(o => o.status === "pending").length;
    let confirmed = allOrdersData.filter(o => o.status === "confirmed").length;
    let delivered = allOrdersData.filter(o => o.status === "delivered").length;
    let cancelled = allOrdersData.filter(o => o.status === "cancelled").length;
    let uniqueCustomers = new Set(allOrdersData.map(o => o.uid).filter(Boolean));
    let totalBlocked = Object.values(customerBlockMap).filter(val => val === true).length;
    statTotal.textContent = total;
    statPending.textContent = pending;
    statConfirmed.textContent = confirmed;
    statDelivered.textContent = delivered;
    statCancelled.textContent = cancelled;
    statCustomers.textContent = uniqueCustomers.size;
    statBlocked.textContent = totalBlocked;
}

async function toggleCustomerBlockStatus(uid, blockState) {
    if (!uid) {
        showToast("Error: Associated customer UID not found.");
        return;
    }
    try {
        const cartRef = doc(db, "carts", uid);
        await setDoc(cartRef, { block: blockState }, { merge: true });
        customerBlockMap[uid] = blockState;
        updateStatistics();
        showToast(`Customer account successfully ${blockState ? "blocked" : "unblocked"}.`);
    } catch (err) {
        console.error("Block toggle error:", err);
        showToast("Failed to update customer block status.");
    }
}

function openOrderDrawer(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) return;
    currentSelectedOrder = order;
    drawerOrderIdBadge.textContent = `#${order.id}`;
    const isBlocked = customerBlockMap[order.uid] === true;
    
    let itemsHTML = "";
    const displayItems = order.orderItems || order.items || [];
    if (displayItems && displayItems.length > 0) {
        displayItems.forEach(item => {
            let variantText = 'Standard';
            if (item.selectedVariants) {
                if (typeof item.selectedVariants === 'object' && item.selectedVariants !== null) {
                    variantText = Object.entries(item.selectedVariants)
                        .map(([k, v]) => {
                            let valStr = '';
                            if (typeof v === 'object' && v !== null) {
                                valStr = v.value || JSON.stringify(v);
                            } else {
                                valStr = v;
                            }
                            return `${k}: ${valStr}`;
                        })
                        .join(' | ');
                } else {
                    variantText = String(item.selectedVariants);
                }
            } else if (item.selectedVariant || item.variant) {
                variantText = item.selectedVariant || item.variant;
            }
            
            itemsHTML += `
                <div class="order-item-card">
                    <img src="${escapeHTML(item.productImage || item.image || item.thumbnail || 'https://store.ghotimarket.com/amrweb/website-logo.png')}" alt="Product" class="item-thumb">
                    <div class="item-details">
                        <h4>${escapeHTML(item.productName || item.name || item.title || 'Product')}</h4>
                        <p>ID: ${escapeHTML(item.productId || item.id || 'N/A')} | SKU: ${escapeHTML(item.SKU || item.sku || 'N/A')}</p>
                        <p>Variants: <strong>${escapeHTML(variantText)}</strong></p>
                        <p>Unit Price: BDT ${(item.unitPrice || item.productPrice || item.price || 0).toLocaleString()}</p>
                    </div>
                    <div class="item-pricing">
                        <span class="qty">Qty: ${item.quantity || 1}</span><br>
                        <span class="total">BDT ${(item.totalPrice || (item.price * (item.quantity || 1)) || 0).toLocaleString()}</span>
                    </div>
                </div>
            `;
        });
    } else {
        itemsHTML = "<p>No item records recorded.</p>";
    }

    drawerBodyContent.innerHTML = `
        <div class="drawer-section">
            <h3>Fulfillment Status & Customer Access</h3>
            <div class="details-grid">
                <div class="detail-group">
                    <label>Order Status</label>
                    <select id="edit-order-status">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                        <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
                        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                        <option value="returned" ${order.status === 'returned' ? 'selected' : ''}>Returned</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
                <div class="detail-group">
                    <label>Customer Account Access</label>
                    <div style="padding-top: 6px;">
                        <label class="switch-label">
                            <input type="checkbox" id="drawer-block-toggle" ${isBlocked ? 'checked' : ''}>
                            <span class="slider-toggle"></span>
                            <span style="font-size: 0.85rem; font-weight: 600;">Block Orders</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <div class="drawer-section">
            <h3>Customer & Shipping Details</h3>
            <div class="details-grid">
                <div class="detail-group"><label>Customer Name</label><input type="text" id="edit-customer-name" value="${escapeHTML(order.customerName || order.name || '')}"></div>
                <div class="detail-group"><label>Phone Number</label><input type="text" id="edit-phone" value="${escapeHTML(order.phone || '')}"></div>
                <div class="detail-group"><label>Email Address</label><input type="text" value="${escapeHTML(order.email || '')}" disabled></div>
                <div class="detail-group"><label>User UID</label><input type="text" value="${escapeHTML(order.uid || '')}" disabled></div>
                <div class="detail-group"><label>Full Address / Street</label><input type="text" id="edit-address" value="${escapeHTML(order.fullAddress || order.address || '')}"></div>
                <div class="detail-group"><label>Thana / Upazila</label><input type="text" id="edit-thana" value="${escapeHTML(order.thanaUpazila || order.thana || order.upazila || '')}"></div>
                <div class="detail-group"><label>District</label><input type="text" id="edit-district" value="${escapeHTML(order.district || '')}"></div>
                <div class="detail-group"><label>Division</label><input type="text" id="edit-division" value="${escapeHTML(order.division || '')}"></div>
            </div>
        </div>

        <div class="drawer-section">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>Purchased Items (${displayItems.length})</h3>
                <button id="copy-json-btn" class="primary-btn" style="padding:6px 14px; font-size:12px;">Copy JSON</button>
            </div>
            <div class="order-items-list" style="margin-top:12px;">
                ${itemsHTML}
            </div>
        </div>

        <div class="drawer-section">
            <h3>Financial Summary</h3>
            <div class="details-grid">
                <div class="detail-group"><label>Subtotal</label><span>BDT ${(order.subtotal || 0).toLocaleString()}</span></div>
                <div class="detail-group"><label>Discount</label><span>BDT ${(order.discount || 0).toLocaleString()}</span></div>
                <div class="detail-group"><label>Delivery Charge</label><span>BDT ${(order.deliveryCharge || 0).toLocaleString()}</span></div>
                <div class="detail-group"><label>Grand Total</label><strong style="color: var(--primary);">BDT ${(order.grandTotal || order.total || 0).toLocaleString()}</strong></div>
                <div class="detail-group"><label>Promo Code Applied</label><span>${escapeHTML(order.appliedPromoCode || order.promoCode || 'None')}</span></div>
                <div class="detail-group"><label>Delivery Area</label><span>${escapeHTML(order.deliveryArea || 'N/A')}</span></div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const copyBtn = document.getElementById("copy-json-btn");
        if (copyBtn) {
            copyBtn.addEventListener("click", async () => {
                try {
                    const jsonString = JSON.stringify(order, null, 2);
                    await copyToClipboard(jsonString);
                    showToast("Order JSON copied successfully!");
                    copyBtn.textContent = "Copied!";
                    setTimeout(() => copyBtn.textContent = "Copy JSON", 2000);
                } catch (e) {
                    showToast("Copy failed: " + e.message);
                }
            });
        }
    }, 100);

    orderDrawer.style.display = "flex";
}

function closeOrderDrawer() {
    orderDrawer.style.display = "none";
    currentSelectedOrder = null;
}

drawerCloseBtn.addEventListener("click", closeOrderDrawer);
drawerCloseActionBtn.addEventListener("click", closeOrderDrawer);

drawerSaveOrderBtn.addEventListener("click", async () => {
    if (!currentSelectedOrder) return;
    drawerSaveOrderBtn.disabled = true;
    drawerSaveOrderBtn.textContent = "Saving...";
    try {
        const newStatus = document.getElementById("edit-order-status").value;
        const newName = document.getElementById("edit-customer-name").value.trim();
        const newPhone = document.getElementById("edit-phone").value.trim();
        const newAddress = document.getElementById("edit-address").value.trim();
        const newThana = document.getElementById("edit-thana").value.trim();
        const newDistrict = document.getElementById("edit-district").value.trim();
        const newDivision = document.getElementById("edit-division").value.trim();
        const newBlockState = document.getElementById("drawer-block-toggle").checked;
        
        const orderRef = doc(db, "orders", currentSelectedOrder.id);
        await updateDoc(orderRef, {
            status: newStatus,
            customerName: newName,
            phone: newPhone,
            fullAddress: newAddress,
            thanaUpazila: newThana,
            district: newDistrict,
            division: newDivision,
            updatedAt: serverTimestamp()
        });

        if (currentSelectedOrder.uid && customerBlockMap[currentSelectedOrder.uid] !== newBlockState) {
            await toggleCustomerBlockStatus(currentSelectedOrder.uid, newBlockState);
        }

        showToast("Order records updated successfully.");
        closeOrderDrawer();
        loadOrdersFirstBatch();
    } catch (err) {
        console.error("Error saving order:", err);
        showToast("Failed to update order details.");
    } finally {
        drawerSaveOrderBtn.disabled = false;
        drawerSaveOrderBtn.textContent = "Save Order Changes";
    }
});

function openDeleteModal(orderId) {
    orderToDeleteId = orderId;
    deleteTargetId.textContent = `#${orderId.slice(0, 8)}`;
    confirmDeleteModal.style.display = "flex";
}

function closeDeleteModal() {
    confirmDeleteModal.style.display = "none";
    orderToDeleteId = null;
}

confirmDeleteCancelBtn.addEventListener("click", closeDeleteModal);

confirmDeleteProceedBtn.addEventListener("click", async () => {
    if (!orderToDeleteId) return;
    confirmDeleteProceedBtn.disabled = true;
    confirmDeleteProceedBtn.textContent = "Deleting...";
    try {
        await deleteDoc(doc(db, "orders", orderToDeleteId));
        showToast("Order permanently deleted.");
        closeDeleteModal();
        loadOrdersFirstBatch();
    } catch (err) {
        console.error("Order deletion error:", err);
        showToast("Failed to delete order record.");
    } finally {
        confirmDeleteProceedBtn.disabled = false;
        confirmDeleteProceedBtn.textContent = "Delete Order";
    }
});

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

function showToast(msg) {
    toastMsg.textContent = msg;
    appToast.style.display = "block";
    setTimeout(() => {
        appToast.style.display = "none";
    }, 3000);
}

function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
