import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Constants & Fallbacks
const FALLBACK_IMAGE = "https://ghotimarket.com/amrweb/banner1.png";
const PRODUCTS_PER_PAGE = 20;

// Application State
let currentUser = null;
let currentCartItems = [];
let categoryId = null;
let categoryName = "";
let loadedProducts = [];
let lastVisibleDoc = null;
let hasMoreProducts = true;
let isLoadingMore = false;
let pendingAction = null; // { type: 'add' | 'buy', product: Object, variants?: Object, quantity?: number }
let activeSliders = new Map(); // productId -> intervalId

// DOM Elements
const elSkeletonGrid = document.getElementById('gi-skeleton-grid');
const elProductGrid = document.getElementById('gi-product-grid');
const elCategoryHeader = document.getElementById('gi-category-header');
const elCatTitle = document.getElementById('gi-cat-title');
const elCatDesc = document.getElementById('gi-cat-desc');
const elCatCount = document.getElementById('gi-cat-count');
const elCatBannerImg = document.getElementById('gi-cat-banner-img');
const elSearchSection = document.getElementById('gi-search-section');
const elSearchInput = document.getElementById('gi-product-search-input');
const elClearSearchBtn = document.getElementById('gi-clear-search-btn');
const elFilteredCount = document.getElementById('gi-filtered-count');
const elTotalLoadedCount = document.getElementById('gi-total-loaded-count');
const elLoadMoreContainer = document.getElementById('gi-load-more-container');
const elLoadMoreBtn = document.getElementById('gi-load-more-btn');
const elEmptyState = document.getElementById('gi-empty-state');
const elErrorState = document.getElementById('gi-error-state');
const elErrorTitle = document.getElementById('gi-error-title');
const elErrorDesc = document.getElementById('gi-error-desc');
const elRetryBtn = document.getElementById('gi-retry-btn');
const elCartBadge = document.getElementById('gi-cart-badge');
const elHeaderLoginBtn = document.getElementById('gi-header-login-btn');
const elHeaderUserProfile = document.getElementById('gi-header-user-profile');
const elUserAvatar = document.getElementById('gi-user-avatar');

// Modals
const elLoginModal = document.getElementById('gi-login-modal');
const elLoginCloseBtn = document.getElementById('gi-login-close-btn');
const elGoogleSigninBtn = document.getElementById('gi-google-signin-btn');

const elVariantModal = document.getElementById('gi-variant-modal');
const elVariantCloseBtn = document.getElementById('gi-variant-close-btn');
const elModalProdImg = document.getElementById('gi-modal-prod-img');
const elModalProdName = document.getElementById('gi-modal-prod-name');
const elModalProdPrice = document.getElementById('gi-modal-prod-price');
const elModalProdOldPrice = document.getElementById('gi-modal-prod-old-price');
const elModalDiscountBadge = document.getElementById('gi-modal-discount-badge');
const elVariantGroupsContainer = document.getElementById('gi-variant-groups-container');
const elQtyMinus = document.getElementById('gi-qty-minus');
const elQtyPlus = document.getElementById('gi-qty-plus');
const elQtyValue = document.getElementById('gi-qty-value');
const elModalTotalPrice = document.getElementById('gi-modal-total-price');
const elModalCancelBtn = document.getElementById('gi-modal-cancel-btn');
const elModalConfirmBtn = document.getElementById('gi-modal-confirm-btn');

// HTML Sanitizer Utility
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Toast Notification System
function showToast(message, type = 'success') {
    const container = document.getElementById('gi-toast-container');
    const toast = document.createElement('div');
    toast.className = `gi-toast ${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else {
        iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Extract Category Slug Robustly
function extractCategorySlug() {
    const searchStr = window.location.search;
    if (!searchStr || searchStr.length <= 1) return null;

    let rawParam = searchStr.substring(1).split('&')[0];
    if (rawParam.includes('=')) {
        rawParam = rawParam.split('=')[0];
    }

    rawParam = rawParam.trim();
    if (rawParam.endsWith('-true')) {
        rawParam = rawParam.slice(0, -5);
    }

    try {
        rawParam = decodeURIComponent(rawParam);
    } catch (e) {
        // fallback
    }

    const ignoredTrackingParams = ['fbclid', 'gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'];
    if (!rawParam || ignoredTrackingParams.includes(rawParam.toLowerCase())) {
        return null;
    }

    return rawParam.trim();
}

// Update SEO and Meta Tags
function updatePageSEO(catName, catImage = '') {
    const title = `${catName} | Gadgeta Item`;
    document.title = title;
    
    const desc = `Explore top quality ${catName} and tech accessories at Gadgeta Item. Shop the latest products with secure checkout and fast delivery.`;
    
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', desc);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', desc);

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', window.location.href);

    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) ogImg.setAttribute('content', catImage || FALLBACK_IMAGE);

    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', title);

    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', desc);

    const twImg = document.querySelector('meta[name="twitter:image"]');
    if (twImg) twImg.setAttribute('content', catImage || FALLBACK_IMAGE);

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', window.location.href.split('?')[0] + '?' + extractCategorySlug());

    const seoSchema = document.getElementById('seo-schema');
    if (seoSchema) {
        seoSchema.textContent = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": catName,
            "description": desc,
            "url": window.location.href
        });
    }
}

// Format Price in BDT
function formatPrice(amount) {
    if (isNaN(amount)) return '৳0';
    return '৳' + Number(amount).toLocaleString('en-IN');
}

// Authentication State Observer
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        elHeaderLoginBtn.style.display = 'none';
        elHeaderUserProfile.style.display = 'block';
        elUserAvatar.src = user.photoURL || 'https://store.ghotimarket.com/amrweb/website-logo.png';
        await fetchUserCart();
    } else {
        elHeaderLoginBtn.style.display = 'block';
        elHeaderUserProfile.style.display = 'none';
        currentCartItems = [];
        updateCartBadgeUI();
        renderProductsGrid(); // Refresh UI cart states
    }
});

// Fetch User Cart
async function fetchUserCart() {
    if (!currentUser) return;
    try {
        const cartRef = doc(db, "carts", currentUser.uid);
        const cartSnap = await getDoc(cartRef);
        if (cartSnap.exists()) {
            currentCartItems = cartSnap.data().items || [];
        } else {
            currentCartItems = [];
        }
        updateCartBadgeUI();
        renderProductsGrid();
    } catch (error) {
        console.error("Error fetching cart:", error);
    }
}

// Update Cart Badge UI
function updateCartBadgeUI() {
    const count = currentCartItems.length;
    elCartBadge.textContent = count;
}

// Initialize Page Data
async function initCategoryPage() {
    const slug = extractCategorySlug();
    if (!slug) {
        showErrorState("Category Not Found", "No valid category was specified in the URL.");
        return;
    }

    try {
        // 1. Find Category by slug
        const catQuery = query(collection(db, "categories"), where("categorySlug", "==", slug), limit(1));
        const catSnapshot = await getDocs(catQuery);

        if (catSnapshot.empty) {
            showErrorState("Category Not Found", `The category "${escapeHTML(slug)}" does not exist.`);
            return;
        }

        const catDoc = catSnapshot.docs[0];
        categoryId = catDoc.id;
        const catData = catDoc.data();
        categoryName = catData.categoryName || slug;

        // Setup Category UI
        elCatTitle.textContent = categoryName;
        elCatDesc.textContent = `Explore premium collection of ${categoryName} at Gadgeta Item.`;
        if (catData.categoryImage) {
            elCatBannerImg.src = catData.categoryImage;
            elCatBannerImg.onerror = () => { elCatBannerImg.src = FALLBACK_IMAGE; };
        } else {
            elCatBannerImg.src = FALLBACK_IMAGE;
        }

        updatePageSEO(categoryName, catData.categoryImage);
        elCategoryHeader.style.display = 'flex';
        elSearchSection.style.display = 'flex';

        // 2. Load Products by Category
        await loadInitialProducts();

    } catch (error) {
        console.error("Error initializing category page:", error);
        showErrorState("Unable to Load Category", "An error occurred while communicating with the database. Please try again.");
    }
}

// Load Initial Products (First 20)
async function loadInitialProducts() {
    try {
        const prodQuery = query(
            collection(db, "products"),
            where("active", "==", true),
            where("categoryId", "==", categoryId),
            orderBy("createdAt", "desc"),
            limit(PRODUCTS_PER_PAGE)
        );

        const prodSnapshot = await getDocs(prodQuery);
        elSkeletonGrid.style.display = 'none';

        if (prodSnapshot.empty) {
            showEmptyState();
            return;
        }

        loadedProducts = [];
        prodSnapshot.forEach((docSnap) => {
            loadedProducts.push({ id: docSnap.id, ...docSnap.data() });
        });

        lastVisibleDoc = prodSnapshot.docs[prodSnapshot.docs.length - 1];
        hasMoreProducts = prodSnapshot.docs.length === PRODUCTS_PER_PAGE;

        renderProductsGrid();

        if (hasMoreProducts) {
            elLoadMoreContainer.style.display = 'flex';
        }

    } catch (error) {
        console.error("Error loading products:", error);
        elSkeletonGrid.style.display = 'none';
        showErrorState("Unable to Load Products", "Failed to retrieve products. If this persists, a Firestore index may be required.");
        elRetryBtn.style.display = 'inline-block';
        elRetryBtn.onclick = () => {
            elErrorState.style.display = 'none';
            elSkeletonGrid.style.display = 'grid';
            initCategoryPage();
        };
    }
}

// Load More Products
async function loadMoreProducts() {
    if (isLoadingMore || !hasMoreProducts || !lastVisibleDoc) return;
    isLoadingMore = true;

    const btnText = elLoadMoreBtn.querySelector('span');
    const spinner = elLoadMoreBtn.querySelector('.gi-btn-spinner');
    btnText.textContent = 'Loading...';
    spinner.style.display = 'block';

    try {
        const prodQuery = query(
            collection(db, "products"),
            where("active", "==", true),
            where("categoryId", "==", categoryId),
            orderBy("createdAt", "desc"),
            startAfter(lastVisibleDoc),
            limit(PRODUCTS_PER_PAGE)
        );

        const prodSnapshot = await getDocs(prodQuery);

        if (prodSnapshot.empty) {
            hasMoreProducts = false;
            elLoadMoreContainer.style.display = 'none';
            isLoadingMore = false;
            return;
        }

        prodSnapshot.forEach((docSnap) => {
            loadedProducts.push({ id: docSnap.id, ...docSnap.data() });
        });

        lastVisibleDoc = prodSnapshot.docs[prodSnapshot.docs.length - 1];
        hasMoreProducts = prodSnapshot.docs.length === PRODUCTS_PER_PAGE;

        if (!hasMoreProducts) {
            elLoadMoreContainer.style.display = 'none';
        }

        renderProductsGrid();
    } catch (error) {
        console.error("Error loading more products:", error);
        showToast("Failed to load more products.", "error");
    } finally {
        isLoadingMore = false;
        btnText.textContent = 'Load More Products';
        spinner.style.display = 'none';
    }
}

elLoadMoreBtn.addEventListener('click', loadMoreProducts);

// Render Products Grid with Search filter
function renderProductsGrid(filteredList = null) {
    const listToRender = filteredList !== null ? filteredList : loadedProducts;

    elCatCount.textContent = `${loadedProducts.length} products loaded`;
    elTotalLoadedCount.textContent = loadedProducts.length;
    elFilteredCount.textContent = listToRender.length;

    if (listToRender.length === 0 && loadedProducts.length > 0) {
        elProductGrid.style.display = 'none';
        elEmptyState.style.display = 'block';
        document.getElementById('gi-empty-title').textContent = 'No Matching Products';
        document.getElementById('gi-empty-desc').textContent = 'No products found matching your search keyword.';
        return;
    } else if (loadedProducts.length === 0) {
        showEmptyState();
        return;
    }

    elEmptyState.style.display = 'none';
    elErrorState.style.display = 'none';
    elProductGrid.style.display = 'grid';

    // Clear existing interval timers for image sliders
    activeSliders.forEach((intervalId) => clearInterval(intervalId));
    activeSliders.clear();

    elProductGrid.innerHTML = '';

    listToRender.forEach((prod) => {
        const card = createProductCard(prod);
        elProductGrid.appendChild(card);
    });
}

// Create Professional Product Card DOM Element
function createProductCard(prod) {
    const card = document.createElement('div');
    card.className = 'gi-product-card';
    card.dataset.productId = prod.id;

    // Price and discount calculations
    const price = Number(prod.productPrice) || 0;
    const oldPrice = Number(prod.oldPrice) || 0;
    const hasDiscount = oldPrice > price;
    let discountPercent = 0;
    let discountAmount = 0;

    if (hasDiscount) {
        discountAmount = oldPrice - price;
        discountPercent = Math.round((discountAmount / oldPrice) * 100);
    }

    // Images array
    let images = Array.isArray(prod.productImage) && prod.productImage.length > 0 ? prod.productImage : [FALLBACK_IMAGE];
    const primaryImg = images[0] || FALLBACK_IMAGE;

    // Cart check
    const isInCart = currentCartItems.some(item => item.productId === prod.id);

    // Badges HTML
    let badgesHTML = '';
    if (hasDiscount && discountPercent > 0) {
        badgesHTML += `<span class="gi-badge gi-badge-discount">${discountPercent}% OFF</span>`;
    }
    if (prod.freeDelivery) {
        badgesHTML += `<span class="gi-badge gi-badge-free-delivery">Free Delivery</span>`;
    }
    if (prod.warranty) {
        badgesHTML += `<span class="gi-badge gi-badge-warranty">${escapeHTML(prod.warranty)} Warranty</span>`;
    }

    // Action button HTML
    let actionBtnHTML = '';
    if (isInCart) {
        actionBtnHTML = `
            <button class="gi-btn-added-status" disabled>This product already added from cart!</button>
            <button class="gi-btn-buy-now gi-action-buy" data-id="${prod.id}">Buy Now</button>
        `;
    } else {
        actionBtnHTML = `
            <button class="gi-btn-add-cart gi-action-add" data-id="${prod.id}">Add to Cart</button>
            <button class="gi-btn-buy-now gi-action-buy" data-id="${prod.id}">Buy Now</button>
        `;
    }

    card.innerHTML = `
        <div class="gi-prod-img-wrap gi-nav-product" data-slug="${escapeHTML(prod.productSlug || '')}">
            <div class="gi-badge-stack">${badgesHTML}</div>
            <img src="${escapeHTML(primaryImg)}" alt="${escapeHTML(prod.productName || 'Product')} - Gadgeta Item" class="gi-prod-img" loading="lazy">
        </div>
        <div class="gi-prod-content">
            <h3 class="gi-prod-title gi-nav-product" data-slug="${escapeHTML(prod.productSlug || '')}" title="${escapeHTML(prod.productName || '')}">${escapeHTML(prod.productName || '')}</h3>
            <div class="gi-prod-price-box">
                <span class="gi-current-price">${formatPrice(price)}</span>
                ${hasDiscount ? `<span class="gi-old-price">${formatPrice(oldPrice)}</span>` : ''}
            </div>
            <div class="gi-prod-actions">
                ${actionBtnHTML}
            </div>
        </div>
    `;

    // Multi-image Slider setup if images > 1
    if (images.length > 1) {
        const imgElement = card.querySelector('.gi-prod-img');
        let currentIdx = 0;
        const intervalId = setInterval(() => {
            currentIdx = (currentIdx + 1) % images.length;
            imgElement.classList.add('gi-fade-out');
            setTimeout(() => {
                imgElement.src = images[currentIdx];
                imgElement.onerror = () => { imgElement.src = FALLBACK_IMAGE; };
                imgElement.classList.remove('gi-fade-out');
            }, 250);
        }, 3500);
        activeSliders.set(prod.id, intervalId);
    }

    // Event Listeners for Navigation
    card.querySelectorAll('.gi-nav-product').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const slug = el.dataset.slug;
            if (slug) {
                window.location.href = `product?${slug}`;
            }
        });
    });

    // Add to Cart Click
    const addBtn = card.querySelector('.gi-action-add');
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleAddToCartClick(prod);
        });
    }

    // Buy Now Click
    const buyBtn = card.querySelector('.gi-action-buy');
    if (buyBtn) {
        buyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleBuyNowClick(prod);
        });
    }

    return card;
}

// Search functionality
elSearchInput.addEventListener('input', (e) => {
    const queryVal = e.target.value.toLowerCase().trim();
    if (queryVal.length > 0) {
        elClearSearchBtn.style.display = 'block';
    } else {
        elClearSearchBtn.style.display = 'none';
    }

    const filtered = loadedProducts.filter(prod => {
        const nameMatch = prod.productName && prod.productName.toLowerCase().includes(queryVal);
        const skuMatch = prod.SKU && prod.SKU.toLowerCase().includes(queryVal);
        return nameMatch || skuMatch;
    });

    renderProductsGrid(filtered);
});

elClearSearchBtn.addEventListener('click', () => {
    elSearchInput.value = '';
    elClearSearchBtn.style.display = 'none';
    renderProductsGrid(loadedProducts);
});

// Empty and Error States
function showEmptyState() {
    elSkeletonGrid.style.display = 'none';
    elProductGrid.style.display = 'none';
    elSearchSection.style.display = 'none';
    elLoadMoreContainer.style.display = 'none';
    elEmptyState.style.display = 'block';
}

function showErrorState(title, desc) {
    elSkeletonGrid.style.display = 'none';
    elProductGrid.style.display = 'none';
    elSearchSection.style.display = 'none';
    elLoadMoreContainer.style.display = 'none';
    elCategoryHeader.style.display = 'none';
    elEmptyState.style.display = 'none';
    
    elErrorTitle.textContent = title;
    elErrorDesc.textContent = desc;
    elErrorState.style.display = 'block';
}

// ---------------------------------------------------------
// CART & CHECKOUT FLOWS WITH VARIANTS & AUTHENTICATION
// ---------------------------------------------------------

function handleAddToCartClick(product) {
    if (!currentUser) {
        pendingAction = { type: 'add', product: product };
        openLoginModal();
        return;
    }

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    if (hasVariants) {
        openVariantModal(product, 'add');
    } else {
        saveProductToCart(product, {}, 1, Number(product.productPrice) || 0);
    }
}

function handleBuyNowClick(product) {
    const isInCart = currentCartItems.some(item => item.productId === product.id);
    
    if (isInCart) {
        // Direct checkout redirect without duplicate
        window.location.href = "/checkout";
        return;
    }

    if (!currentUser) {
        pendingAction = { type: 'buy', product: product };
        openLoginModal();
        return;
    }

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    if (hasVariants) {
        openVariantModal(product, 'buy');
    } else {
        saveProductToCart(product, {}, 1, Number(product.productPrice) || 0, true);
    }
}

// Google Login Modal Handlers
elHeaderLoginBtn.addEventListener('click', openLoginModal);
elLoginCloseBtn.addEventListener('click', closeLoginModal);
elLoginModal.addEventListener('click', (e) => {
    if (e.target === elLoginModal) closeLoginModal();
});

function openLoginModal() {
    elLoginModal.style.display = 'flex';
}

function closeLoginModal() {
    elLoginModal.style.display = 'none';
}

elGoogleSigninBtn.addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        currentUser = result.user;
        closeLoginModal();
        showToast("Successfully signed in!");
        await fetchUserCart();

        if (pendingAction) {
            const action = pendingAction;
            pendingAction = null;
            if (action.type === 'add') {
                handleAddToCartClick(action.product);
            } else if (action.type === 'buy') {
                handleBuyNowClick(action.product);
            }
        }
    } catch (error) {
        console.error("Sign in failed:", error);
        showToast("Sign in failed or was cancelled.", "error");
    }
});

// Variant Selection Modal Logic
let activeModalProduct = null;
let activeModalAction = null; // 'add' or 'buy'
let selectedVariantsState = {};
let currentQuantityState = 1;

function openVariantModal(product, actionType) {
    activeModalProduct = product;
    activeModalAction = actionType;
    selectedVariantsState = {};
    currentQuantityState = 1;

    let images = Array.isArray(product.productImage) && product.productImage.length > 0? product.productImage : [FALLBACK_IMAGE];
    elModalProdImg.src = images[0];
    elModalProdImg.onerror = () => { elModalProdImg.src = FALLBACK_IMAGE; };
    elModalProdName.textContent = product.productName || '';

    updateModalPricingAndUI();

    elVariantGroupsContainer.innerHTML = '';
    if (Array.isArray(product.variants)) {
        product.variants.forEach((group, groupIdx) => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'gi-variant-group';

            const titleEl = document.createElement('div');
            titleEl.className = 'gi-variant-group-title';
            titleEl.textContent = group.name || `Option ${groupIdx + 1}`;
            groupDiv.appendChild(titleEl);

            const optionsGrid = document.createElement('div');
            optionsGrid.className = 'gi-variant-options-grid';

            if (Array.isArray(group.values)) {
                group.values.forEach((opt, optIdx) => {
                    const chip = document.createElement('div');
                    chip.className = 'gi-variant-chip';

                    // ✅ FIX 1: এখানে ছিল opt.value, এখন object
                    if (optIdx === 0) {
                        chip.classList.add('selected');
                        selectedVariantsState[group.name] = {
                            value: opt.value,
                            extraPrice: Number(opt.extraPrice) || 0
                        };
                    }

                    let extraText = '';
                    const extraPrice = Number(opt.extraPrice) || 0;
                    if (extraPrice > 0) {
                        extraText = ` (+৳${extraPrice.toLocaleString('en-IN')})`;
                    }

                    chip.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        <span>${escapeHTML(opt.value)}${extraText}</span>
                    `;

                    chip.addEventListener('click', () => {
                        optionsGrid.querySelectorAll('.gi-variant-chip').forEach(c => c.classList.remove('selected'));
                        chip.classList.add('selected');
                        // ✅ FIX 2: এখানেও object
                        selectedVariantsState[group.name] = {
                            value: opt.value,
                            extraPrice: Number(opt.extraPrice) || 0
                        };
                        updateModalPricingAndUI();
                    });

                    optionsGrid.appendChild(chip);
                });
            }
            groupDiv.appendChild(optionsGrid);
            elVariantGroupsContainer.appendChild(groupDiv);
        });
    }

    elQtyValue.textContent = currentQuantityState;
    elModalConfirmBtn.textContent = actionType === 'buy'? 'Buy Now' : 'Add to Cart';
    elVariantModal.style.display = 'flex';
}

function updateModalPricingAndUI() {
    if (!activeModalProduct) return;
    const basePrice = Number(activeModalProduct.productPrice) || 0;

    let extraSum = 0;
    Object.values(selectedVariantsState).forEach(v => {
        extraSum += Number(v.extraPrice) || 0;
    });

    const finalUnitPrice = basePrice + extraSum;
    const totalPrice = finalUnitPrice * currentQuantityState;

    elModalProdPrice.textContent = formatPrice(finalUnitPrice);
    elModalTotalPrice.textContent = formatPrice(totalPrice);
}

// Quantity controls in modal
elQtyMinus.addEventListener('click', () => {
    if (currentQuantityState > 1) {
        currentQuantityState--;
        elQtyValue.textContent = currentQuantityState;
        updateModalPricingAndUI();
    }
});

elQtyPlus.addEventListener('click', () => {
    currentQuantityState++;
    elQtyValue.textContent = currentQuantityState;
    updateModalPricingAndUI();
});

elVariantCloseBtn.addEventListener('click', closeVariantModal);
elModalCancelBtn.addEventListener('click', closeVariantModal);
elVariantModal.addEventListener('click', (e) => {
    if (e.target === elVariantModal) closeVariantModal();
});

function closeVariantModal() {
    elVariantModal.style.display = 'none';
    activeModalProduct = null;
    activeModalAction = null;
}

elModalConfirmBtn.addEventListener('click', () => {
    if (!activeModalProduct) return;

    if (Array.isArray(activeModalProduct.variants)) {
        for (let group of activeModalProduct.variants) {
            if (!selectedVariantsState[group.name]) {
                showToast(`Please select a ${group.name}`, 'error');
                return;
            }
        }
    }

    const basePrice = Number(activeModalProduct.productPrice) || 0;
    let extraSum = 0;
    // ✅ FIX - Direct extraPrice from selectedVariantsState
    Object.values(selectedVariantsState).forEach(v => {
        extraSum += Number(v.extraPrice) || 0;
    });

    const finalUnitPrice = basePrice + extraSum;
    const isBuyNow = activeModalAction === 'buy';

    closeVariantModal();
    saveProductToCart(activeModalProduct, selectedVariantsState, currentQuantityState, finalUnitPrice, isBuyNow);
});

// Save Product to Firestore Cart
async function saveProductToCart(product, selectedVariants, quantity, unitPrice, redirectToCheckout = false) {
    if (!currentUser) {
        showToast("Please sign in first.", "error");
        return;
    }

    try {
        const userCartRef = doc(db, "carts", currentUser.uid);
        const docSnap = await getDoc(userCartRef);
        let items = docSnap.exists() ? (docSnap.data().items || []) : [];

        const existingIndex = items.findIndex(item => item.productId === product.id);

        if (existingIndex !== -1) {
            // Already in cart
            if (redirectToCheckout) {
                window.location.href = "/checkout";
                return;
            } else {
                showToast("This product already added from cart!", "success");
                return;
            }
        }

        const primaryImage = Array.isArray(product.productImage) && product.productImage.length > 0 ? product.productImage[0] : FALLBACK_IMAGE;

        const newItem = {
            productId: product.id,
            productName: product.productName || '',
            productSlug: product.productSlug || '',
            productImage: primaryImage,
            productPrice: Number(product.productPrice) || 0,
            selectedVariants: selectedVariants || {},
            quantity: quantity || 1,
            unitPrice: unitPrice,
            totalPrice: unitPrice * (quantity || 1),
            SKU: product.SKU || '',
            categoryId: product.categoryId || '',
            freeDelivery: !!product.freeDelivery,
            addedAt: new Date().toISOString()
        };

        items.push(newItem);

        await setDoc(userCartRef, {
            uid: currentUser.uid,
            email: currentUser.email || '',
            updatedAt: new Date().toISOString(),
            items: items
        }, { merge: true });

        currentCartItems = items;
        updateCartBadgeUI();
        renderProductsGrid();

        if (redirectToCheckout) {
            window.location.href = "/checkout";
        } else {
            showToast("Added to Cart successfully!");
        }

    } catch (error) {
        console.error("Error saving to cart:", error);
        showToast("Failed to update cart. Please try again.", "error");
    }
}

// Global Keyboard Escape listener for modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeLoginModal();
        closeVariantModal();
    }
});

// Run initialization on page load
window.addEventListener('DOMContentLoaded', initCategoryPage);
