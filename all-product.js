import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const googleProvider = new GoogleAuthProvider();

// State Variables for Pagination (Limit 20 items per batch)
let allProducts = [];
let filteredProducts = [];
let renderedCount = 0;
const BATCH_LIMIT = 20;
let userCartItems = [];
let currentUser = null;
let pendingAction = null;
let sliderIntervals = new Map();

// DOM Elements
const productGrid = document.getElementById('giProductGrid');
const loadMoreContainer = document.getElementById('giLoadMoreContainer');
const loadMoreBtn = document.getElementById('giLoadMoreBtn');
const errorState = document.getElementById('giErrorState');
const emptyState = document.getElementById('giEmptyState');
const retryBtn = document.getElementById('giRetryBtn');
const searchInput = document.getElementById('giSearchInput');
const mobileSearchInput = document.getElementById('giMobileSearchInput');
const categoryFilter = document.getElementById('giCategoryFilter');
const freeDeliveryFilter = document.getElementById('giFreeDeliveryFilter');
const sortSelect = document.getElementById('giSortSelect');
const cartBadge = document.getElementById('giCartBadge');
const authModal = document.getElementById('giAuthModal');
const closeModalBtn = document.getElementById('giCloseModalBtn');
const googleLoginBtn = document.getElementById('giGoogleLoginBtn');
const authLoading = document.getElementById('giAuthLoading');
const toastContainer = document.getElementById('giToastContainer');
const productModal = document.getElementById('giProductModal');
const closeProductModalBtn = document.getElementById('giCloseProductModalBtn');
const modalBodyContent = document.getElementById('giModalBodyContent');

// Safe HTML Escaping
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Generate Slug Helper
function generateSlug(name) {
    if (!name) return 'product';
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

// Toast Notification System
function showToast(message, type = 'default') {
    const toast = document.createElement('div');
    toast.className = `gi-toast ${type}`;
    
    let iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    if (type === 'success') {
        iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else if (type === 'error') {
        iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHTML(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Authentication & Cart Sync
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        await fetchUserCart();
    } else {
        userCartItems = [];
        updateCartBadgeCount();
    }
    renderProducts(true);
});

async function fetchUserCart() {
    if (!currentUser) return;
    try {
        const userCartRef = doc(db, "carts", currentUser.uid);
        const docSnap = await getDoc(userCartRef);
        if (docSnap.exists()) {
            userCartItems = docSnap.data().items || [];
        } else {
            userCartItems = [];
        }
    } catch (error) {
        console.error("Error fetching cart:", error);
        userCartItems = [];
    }
    updateCartBadgeCount();
}

async function saveCartItemToFirestore(newItem) {
    if (!currentUser) return { success: false, isDuplicate: false };
    const userCartRef = doc(db, "carts", currentUser.uid);

    try {
        const docSnap = await getDoc(userCartRef);
        let items = [];

        if (docSnap.exists()) {
            items = docSnap.data().items || [];
        }

        const existingIndex = items.findIndex(item => item.productId === newItem.productId);
        if (existingIndex > -1) {
            return { success: true, isDuplicate: true };
        }

        items.push(newItem);

        await setDoc(userCartRef, {
            uid: currentUser.uid,
            email: currentUser.email || '',
            updatedAt: new Date().toISOString(),
            items: items
        }, { merge: true });

        userCartItems = items;
        return { success: true, isDuplicate: false };
    } catch (error) {
        console.error("Cart save error:", error);
        showToast("Failed to update cart. Please try again.", "error");
        return { success: false, isDuplicate: false };
    }
}

function updateCartBadgeCount() {
    const count = userCartItems ? userCartItems.length : 0;
    if(cartBadge) cartBadge.textContent = count;
    const navBadge = document.getElementById('nav-cart-badge');
    if(navBadge) navBadge.textContent = count;
}

// Fetch Products from Firestore
async function loadProducts() {
    productGrid.style.display = 'grid';
    errorState.style.display = 'none';
    emptyState.style.display = 'none';
    
    try {
        const q = query(collection(db, "products"), where("active", "==", true));
        const querySnapshot = await getDocs(q);
        allProducts = [];
        
        querySnapshot.forEach((docSnap) => {
            allProducts.push({ id: docSnap.id, ...docSnap.data() });
        });

        populateCategories();
        filterAndSortProducts();
    } catch (error) {
        console.error("Error loading products:", error);
        productGrid.style.display = 'none';
        errorState.style.display = 'block';
    }
}

// Populate Category Filter Options
function populateCategories() {
    const categoriesMap = new Map();
    allProducts.forEach(product => {
        if (product.categoryId && product.categoryName) {
            categoriesMap.set(product.categoryId, product.categoryName);
        }
    });

    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categoriesMap.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        categoryFilter.appendChild(option);
    });
}

// Filtering & Sorting Logic
function filterAndSortProducts() {
    const searchTerm = (searchInput.value || mobileSearchInput.value || '').toLowerCase().trim();
    const selectedCategory = categoryFilter.value;
    const isFreeDelivery = freeDeliveryFilter.checked;
    const sortBy = sortSelect.value;

    filteredProducts = allProducts.filter(product => {
        if (searchTerm) {
            const matchesName = (product.productName || '').toLowerCase().includes(searchTerm);
            const matchesDesc = (product.productDescription || '').toLowerCase().includes(searchTerm);
            const matchesPrice = (product.productPrice || '').toString().toLowerCase().includes(searchTerm);
            const matchesSKU = (product.SKU || '').toLowerCase().includes(searchTerm);
            const matchesCat = (product.categoryName || '').toLowerCase().includes(searchTerm);
            if (!matchesName && !matchesDesc && !matchesPrice && !matchesSKU && !matchesCat) return false;
        }

        if (selectedCategory && product.categoryId !== selectedCategory) {
            return false;
        }

        if (isFreeDelivery && !product.freeDelivery) {
            return false;
        }

        return true;
    });

    filteredProducts.sort((a, b) => {
        const priceA = a.productPrice || 0;
        const priceB = b.productPrice || 0;
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;

        const discountA = (a.oldPrice && a.oldPrice > a.productPrice) ? (a.oldPrice - a.productPrice) / a.oldPrice : 0;
        const discountB = (b.oldPrice && b.oldPrice > b.productPrice) ? (b.oldPrice - b.productPrice) / b.oldPrice : 0;

        if (sortBy === 'price-low') return priceA - priceB;
        if (sortBy === 'price-high') return priceB - priceA;
        if (sortBy === 'newest') return timeB - timeA;
        if (sortBy === 'oldest') return timeA - timeB;
        if (sortBy === 'discount') return discountB - discountA;
        return 0;
    });

    renderProducts(true);
}

// Clear Sliders Cleanup
function clearAllSliders() {
    sliderIntervals.forEach(interval => clearInterval(interval));
    sliderIntervals.clear();
}

// Render Products Grid with Limit 20 and Load More Button Support
function renderProducts(reset = false) {
    if (reset) {
        clearAllSliders();
        productGrid.innerHTML = '';
        renderedCount = 0;
    }

    if (filteredProducts.length === 0) {
        productGrid.style.display = 'none';
        loadMoreContainer.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    productGrid.style.display = 'grid';
    emptyState.style.display = 'none';

    const nextBatch = filteredProducts.slice(renderedCount, renderedCount + BATCH_LIMIT);
    nextBatch.forEach(product => {
        const card = createProductCard(product);
        productGrid.appendChild(card);
    });

    renderedCount += nextBatch.length;

    // Show or Hide Load More Button based on remaining products
    if (renderedCount < filteredProducts.length) {
        loadMoreContainer.style.display = 'flex';
    } else {
        loadMoreContainer.style.display = 'none';
    }
}

// Load More Button Event Listener
if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
        if (renderedCount < filteredProducts.length) {
            renderProducts(false);
        }
    });
}

// Helper to compute unit price based on variants extra price
function computeUnitPrice(basePrice, selectedVariants) {
    let extra = 0;
    if (selectedVariants) {
        Object.values(selectedVariants).forEach(valObj => {
            extra += Number(valObj.extraPrice) || 0;
        });
    }
    return basePrice + extra;
}

// Add Item to Cart Functionality with "Saving" loading state
async function handleAddToCart(product, selectedVariants, quantity, buttonElement = null) {
    if (!currentUser) {
        pendingAction = { type: 'cart', product, selectedVariants, quantity };
        authModal.style.display = 'flex';
        return;
    }

    let originalBtnHtml = '';
    if (buttonElement) {
        originalBtnHtml = buttonElement.innerHTML;
        buttonElement.disabled = true;
        buttonElement.classList.add('gi-btn-loading');
        buttonElement.innerHTML = `<div class="gi-btn-spinner"></div><span>saving</span>`;
    }

    const basePrice = Number(product.productPrice) || 0;
    const finalUnitPrice = computeUnitPrice(basePrice, selectedVariants);
    const finalQuantity = quantity || 1;
    const productSlug = product.productSlug || generateSlug(product.productName);
    const productImage = (product.productImage && product.productImage[0]) ? product.productImage[0] : 'https://ghotimarket.com/amrweb/banner1.png';

    const newItem = {
        productId: product.id,
        productName: product.productName || '',
        productSlug: productSlug,
        productImage: productImage,
        productPrice: basePrice,
        selectedVariants: selectedVariants || {},
        quantity: finalQuantity,
        unitPrice: finalUnitPrice,
        totalPrice: finalUnitPrice * finalQuantity,
        SKU: product.SKU || '',
        categoryId: product.categoryId || '',
        freeDelivery: !!product.freeDelivery,
        addedAt: new Date().toISOString()
    };

    const res = await saveCartItemToFirestore(newItem);
    updateCartBadgeCount();

    if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.classList.remove('gi-btn-loading');
        buttonElement.innerHTML = originalBtnHtml;
    }

    if (res.isDuplicate) {
        showToast("This product already added from cart!");
    } else if (res.success) {
        showToast("Added to Cart successfully!", "success");
        closeProductModal();
        renderProducts(true);
    }
}

// Buy Now Functionality with "Saving" loading state
async function handleBuyNow(product, selectedVariants, quantity, buttonElement = null) {
    if (!currentUser) {
        pendingAction = { type: 'buynow', product, selectedVariants, quantity };
        authModal.style.display = 'flex';
        return;
    }

    let originalBtnHtml = '';
    if (buttonElement) {
        originalBtnHtml = buttonElement.innerHTML;
        buttonElement.disabled = true;
        buttonElement.classList.add('gi-btn-loading');
        buttonElement.innerHTML = `<div class="gi-btn-spinner"></div><span>saving</span>`;
    }

    const basePrice = Number(product.productPrice) || 0;
    const finalUnitPrice = computeUnitPrice(basePrice, selectedVariants);
    const finalQuantity = quantity || 1;
    const productSlug = product.productSlug || generateSlug(product.productName);
    const productImage = (product.productImage && product.productImage[0]) ? product.productImage[0] : 'https://ghotimarket.com/amrweb/banner1.png';

    const newItem = {
        productId: product.id,
        productName: product.productName || '',
        productSlug: productSlug,
        productImage: productImage,
        productPrice: basePrice,
        selectedVariants: selectedVariants || {},
        quantity: finalQuantity,
        unitPrice: finalUnitPrice,
        totalPrice: finalUnitPrice * finalQuantity,
        SKU: product.SKU || '',
        categoryId: product.categoryId || '',
        freeDelivery: !!product.freeDelivery,
        addedAt: new Date().toISOString()
    };

    await saveCartItemToFirestore(newItem);
    updateCartBadgeCount();
    closeProductModal();
    window.location.href = '/checkout';
}

// Create Product Card DOM Element
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'gi-product-card';

    const isAlreadyInCart = userCartItems.some(item => item.productId === product.id);

    const images = (product.productImage && product.productImage.length > 0) 
        ? product.productImage 
        : ['https://ghotimarket.com/amrweb/banner1.png'];

    const primaryImage = images[0];
    const productSlug = product.productSlug || generateSlug(product.productName);

    const basePrice = Number(product.productPrice) || 0;
    const oldPrice = Number(product.oldPrice) || 0;
    const hasDiscount = oldPrice > basePrice;
    let saved = 0;
    let percent = 0;
    if (hasDiscount) {
        saved = oldPrice - basePrice;
        percent = Math.round((saved / oldPrice) * 100);
    }

    const cardHTML = `
        <div class="gi-card-img-container" data-action="detail" data-slug="${escapeHTML(productSlug)}">
            <img src="${escapeHTML(primaryImage)}" alt="${escapeHTML(product.productName)}" class="gi-card-img" id="img-${product.id}" loading="lazy" onerror="this.src='https://ghotimarket.com/amrweb/banner1.png'">
            <div class="gi-badge-wrapper">
                ${hasDiscount ? `<span class="gi-badge discount">${percent}% OFF</span>` : ''}
                ${product.freeDelivery ? '<span class="gi-badge free-delivery">Free Delivery</span>' : ''}
                ${product.warranty ? `<span class="gi-badge warranty">${escapeHTML(product.warranty)}</span>` : ''}
            </div>
        </div>
        <div class="gi-card-content">
            <h3 class="gi-product-title" data-action="detail" data-slug="${escapeHTML(productSlug)}">${escapeHTML(product.productName)}</h3>
            
            <div class="gi-pricing-area">
                <div class="gi-price-row">
                    <span class="gi-current-price">৳${basePrice.toLocaleString()}</span>
                    ${hasDiscount ? `<span class="gi-old-price">৳${oldPrice.toLocaleString()}</span>` : ''}
                </div>
                ${hasDiscount ? `<div class="gi-savings-text">Save ৳${saved.toLocaleString()}</div>` : ''}
            </div>

            <div class="gi-card-actions">
                ${isAlreadyInCart ? 
                    `
                    <div class="gi-cart-status">This product already added from cart</div>
                    <button class="gi-btn gi-btn-primary buy-now-direct-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        <span>Buy Now</span>
                    </button>
                    ` :
                    `
                    <div class="gi-card-action-row">
                        <button class="gi-btn gi-btn-outline add-to-cart-card-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                            <span>Add to Cart</span>
                        </button>
                        <button class="gi-btn gi-btn-primary buy-now-card-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            <span>Buy Now</span>
                        </button>
                    </div>
                    `
                }
            </div>
        </div>
    `;

    card.innerHTML = cardHTML;

    // Image Auto Slider Setup
    if (images.length > 1) {
        let currentImgIdx = 0;
        const imgElement = card.querySelector(`#img-${product.id}`);
        const intervalId = setInterval(() => {
            currentImgIdx = (currentImgIdx + 1) % images.length;
            if (imgElement) {
                imgElement.style.opacity = '0';
                setTimeout(() => {
                    imgElement.src = images[currentImgIdx];
                    imgElement.style.opacity = '1';
                }, 200);
            }
        }, 3500);

        sliderIntervals.set(product.id, intervalId);
    }

    const detailTriggers = card.querySelectorAll('[data-action="detail"]');
    detailTriggers.forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `product?${productSlug}`;
        });
    });

    if (isAlreadyInCart) {
        const buyNowDirectBtn = card.querySelector('.buy-now-direct-btn');
        if (buyNowDirectBtn) {
            buyNowDirectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.href = '/checkout';
            });
        }
    } else {
        const addToCartCardBtn = card.querySelector('.add-to-cart-card-btn');
        if (addToCartCardBtn) {
            addToCartCardBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (product.variants && product.variants.length > 0) {
                    openProductPopup(product, false, 'cart');
                } else {
                    handleAddToCart(product, {}, 1, addToCartCardBtn);
                }
            });
        }

        const buyNowCardBtn = card.querySelector('.buy-now-card-btn');
        if (buyNowCardBtn) {
            buyNowCardBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (product.variants && product.variants.length > 0) {
                    openProductPopup(product, false, 'buynow');
                } else {
                    handleBuyNow(product, {}, 1, buyNowCardBtn);
                }
            });
        }
    }

    return card;
}

// Open Professional Popup Modal containing variants selection
function openProductPopup(product, isAlreadyInCart, initialIntent = 'cart') {
    const basePrice = Number(product.productPrice) || 0;
    const oldPrice = Number(product.oldPrice) || 0;
    const hasDiscount = oldPrice > basePrice;
    let saved = hasDiscount ? oldPrice - basePrice : 0;

    const selectedVariants = {};
    if (product.variants && Array.isArray(product.variants)) {
        product.variants.forEach(group => {
            if (group.values && group.values.length > 0) {
                selectedVariants[group.name] = group.values[0];
            }
        });
    }

    let currentQuantity = 1;

    function calculatePopupUnitPrice() {
        return computeUnitPrice(basePrice, selectedVariants);
    }

    let variantsHTML = '';
    if (product.variants && Array.isArray(product.variants)) {
        product.variants.forEach(group => {
            variantsHTML += `
                <div class="gi-variant-group" data-group="${escapeHTML(group.name)}">
                    <span class="gi-variant-label">${escapeHTML(group.name)}</span>
                    <div class="gi-variant-chips">
            `;
            group.values.forEach((valObj, idx) => {
                const isSelected = idx === 0;
                const extraText = valObj.extraPrice > 0 ? ` +৳${valObj.extraPrice}` : '';
                variantsHTML += `
                    <button type="button" class="gi-chip ${isSelected ? 'selected' : ''}" data-group="${escapeHTML(group.name)}" data-val='${JSON.stringify(valObj)}'>
                        <span>${escapeHTML(valObj.value)}${extraText}</span>
                        ${isSelected ? '<svg class="gi-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                    </button>
                `;
            });
            variantsHTML += `</div></div>`;
        });
    }

    modalBodyContent.innerHTML = `
        <h2 class="gi-popup-product-title">${escapeHTML(product.productName)}</h2>
        ${product.productDescription ? `<p class="gi-popup-desc">${escapeHTML(product.productDescription)}</p>` : ''}
        
        <div class="gi-popup-pricing">
            <div class="gi-price-row">
                <span class="gi-current-price" id="popupPriceDisplay">৳${calculatePopupUnitPrice().toLocaleString()}</span>
                ${hasDiscount ? `<span class="gi-old-price">৳${oldPrice.toLocaleString()}</span>` : ''}
            </div>
            ${hasDiscount ? `<div class="gi-savings-text">Save ৳${saved.toLocaleString()}</div>` : ''}
            ${product.warranty ? `<div style="font-size:0.8rem; color:#4f46e5; font-weight:600; margin-top:4px;">Warranty: ${escapeHTML(product.warranty)}</div>` : ''}
            ${product.freeDelivery ? `<div style="font-size:0.8rem; color:var(--gi-success); font-weight:600; margin-top:2px;">Free Delivery Applicable</div>` : ''}
        </div>

        <div class="gi-variants-section" id="popupVariantsContainer">
            ${variantsHTML}
        </div>

        <div class="gi-quantity-area">
            <span class="gi-qty-label">Quantity</span>
            <div class="gi-qty-controls">
                <button class="gi-qty-btn" id="popupMinusBtn" aria-label="Decrease">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <span class="gi-qty-display" id="popupQtyDisplay">1</span>
                <button class="gi-qty-btn" id="popupPlusBtn" aria-label="Increase">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
            </div>
        </div>

        <div class="gi-validation-msg" id="popupValidationMsg"></div>

        <div class="gi-card-actions">
            ${isAlreadyInCart ? 
                `
                <div class="gi-cart-status">This product already added from cart</div>
                <button class="gi-btn gi-btn-primary" id="popupBuyNowDirectBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <span>Buy Now</span>
                </button>
                ` :
                `
                <div class="gi-card-action-row">
                    <button class="gi-btn gi-btn-outline" id="popupAddToCartBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                        <span>Add to Cart</span>
                    </button>
                    <button class="gi-btn gi-btn-primary" id="popupBuyNowBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        <span>Buy Now</span>
                    </button>
                </div>
                `
            }
        </div>
    `;

    modalBodyContent.querySelectorAll('.gi-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const groupName = chip.getAttribute('data-group');
            const valObj = JSON.parse(chip.getAttribute('data-val'));
            selectedVariants[groupName] = valObj;

            const groupContainer = chip.closest('.gi-variant-group');
            groupContainer.querySelectorAll('.gi-chip').forEach(c => {
                c.classList.remove('selected');
                const icon = c.querySelector('.gi-check-icon');
                if (icon) icon.remove();
            });
            chip.classList.add('selected');
            chip.innerHTML += '<svg class="gi-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';

            document.getElementById('popupPriceDisplay').textContent = `৳${calculatePopupUnitPrice().toLocaleString()}`;
            document.getElementById('popupValidationMsg').textContent = '';
        });
    });

    const qtyDisplayEl = document.getElementById('popupQtyDisplay');
    document.getElementById('popupMinusBtn').addEventListener('click', () => {
        if (currentQuantity > 1) {
            currentQuantity--;
            qtyDisplayEl.textContent = currentQuantity;
        }
    });
    document.getElementById('popupPlusBtn').addEventListener('click', () => {
        currentQuantity++;
        qtyDisplayEl.textContent = currentQuantity;
    });

    if (isAlreadyInCart) {
        const buyNowDirectBtn = document.getElementById('popupBuyNowDirectBtn');
        if (buyNowDirectBtn) {
            buyNowDirectBtn.addEventListener('click', () => {
                closeProductModal();
                window.location.href = '/checkout';
            });
        }
    } else {
        const addToCartBtn = document.getElementById('popupAddToCartBtn');
        if (addToCartBtn) {
            addToCartBtn.addEventListener('click', () => {
                handleAddToCart(product, selectedVariants, currentQuantity, addToCartBtn);
            });
        }

        const buyNowBtn = document.getElementById('popupBuyNowBtn');
        if (buyNowBtn) {
            buyNowBtn.addEventListener('click', () => {
                handleBuyNow(product, selectedVariants, currentQuantity, buyNowBtn);
            });
        }
    }

    productModal.style.display = 'flex';
}

function closeProductModal() {
    productModal.style.display = 'none';
}

closeProductModalBtn.addEventListener('click', closeProductModal);
productModal.addEventListener('click', (e) => {
    if (e.target === productModal) closeProductModal();
});

// Event Listeners for Search & Filter Controls
if (searchInput) {
    searchInput.addEventListener('input', filterAndSortProducts);
}
if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', filterAndSortProducts);
}
if (categoryFilter) {
    categoryFilter.addEventListener('change', filterAndSortProducts);
}
if (freeDeliveryFilter) {
    freeDeliveryFilter.addEventListener('change', filterAndSortProducts);
}
if (sortSelect) {
    sortSelect.addEventListener('change', filterAndSortProducts);
}
if (retryBtn) {
    retryBtn.addEventListener('click', loadProducts);
}

// Google Login Modal Controls
googleLoginBtn.addEventListener('click', async () => {
    authLoading.style.display = 'flex';
    googleLoginBtn.style.display = 'none';
    try {
        const result = await signInWithPopup(auth, googleProvider);
        currentUser = result.user;
        await fetchUserCart();
        authModal.style.display = 'none';
        showToast("Successfully signed in!", "success");

        if (pendingAction) {
            const { type, product, selectedVariants, quantity } = pendingAction;
            pendingAction = null;
            if (type === 'cart') {
                await handleAddToCart(product, selectedVariants, quantity);
            } else if (type === 'buynow') {
                await handleBuyNow(product, selectedVariants, quantity);
            }
        }
    } catch (error) {
        console.error("Auth error:", error);
        showToast("Authentication failed. Please try again.", "error");
    } finally {
        authLoading.style.display = 'none';
        googleLoginBtn.style.display = 'flex';
    }
});

closeModalBtn.addEventListener('click', () => {
    authModal.style.display = 'none';
    pendingAction = null;
});

authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
        authModal.style.display = 'none';
        pendingAction = null;
    }
});

// Initial Load Execution
loadProducts();
