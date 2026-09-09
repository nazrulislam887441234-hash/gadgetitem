import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

let currentUser = null;
let currentCategory = null;
let loadedProducts = [];
let lastVisibleDoc = null;
let isLoadingMore = false;
let allCategoryProducts = [];
let searchTimeout = null;
let cartItems = [];
let imageSliders = {};

// Parse Slug from URL
function getCategorySlugFromURL() {
    const searchStr = window.location.search;
    if (!searchStr) return null;
    const cleanSearch = searchStr.startsWith('?') ? searchStr.substring(1) : searchStr;
    const parts = cleanSearch.split('&');
    let firstParam = parts[0].split('=')[0];
    const trackingParams = ['fbclid', 'gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'];
    if (trackingParams.includes(firstParam.toLowerCase())) {
        for (let part of parts) {
            let key = part.split('=')[0];
            if (!trackingParams.includes(key.toLowerCase()) && key) {
                firstParam = key;
                break;
            }
        }
    }
    let slug = firstParam.trim();
    if (slug.endsWith('-true')) {
        slug = slug.substring(0, slug.length - 5);
    }
    return slug || null;
}

function showToast(message) {
    const toast = document.getElementById('gi-toast');
    toast.textContent = message;
    toast.classList.add('gi-show');
    setTimeout(() => {
        toast.classList.remove('gi-show');
    }, 3000);
}

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        await fetchUserCart();
    } else {
        cartItems = [];
        updateCartBadge();
        refreshProductCardsCartState();
    }
});

async function fetchUserCart() {
    if (!currentUser) return;
    try {
        const cartRef = doc(db, "carts", currentUser.uid);
        const cartSnap = await getDoc(cartRef);
        if (cartSnap.exists()) {
            cartItems = cartSnap.data().items || [];
        } else {
            cartItems = [];
        }
    } catch (error) {
        cartItems = [];
    }
    updateCartBadge();
    refreshProductCardsCartState();
}

function updateCartBadge() {
    const badge = document.getElementById('gi-header-cart-count');
    badge.textContent = cartItems.length;
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    const slug = getCategorySlugFromURL();
    if (!slug) {
        renderErrorState("Category Not Found", "No valid category found in URL.", true);
        return;
    }
    await loadCategoryData(slug);
    setupSearchListener();
    setupAuthModalListeners();
});

async function loadCategoryData(slug) {
    try {
        const catQuery = query(collection(db, "categories"), where("categorySlug", "==", slug));
        const catSnapshot = await getDocs(catQuery);
        
        if (catSnapshot.empty) {
            renderErrorState("Category Not Found", "The category you are looking for does not exist.", true);
            return;
        }

        const catDoc = catSnapshot.docs[0];
        currentCategory = { id: catDoc.id, ...catDoc.data() };
        
        renderCategoryHeader(currentCategory);
        updateSEO(currentCategory);
        await loadInitialProducts(currentCategory.id);
    } catch (error) {
        renderErrorState("Something went wrong", "We couldn't load the products right now. Please try again.", false, true);
    }
}

function updateSEO(category) {
    const title = `${category.categoryName} Products | Gadgeta Item`;
    const desc = `Explore professional products from ${category.categoryName} category at Gadgeta Item.`;
    const image = category.categoryImage || "https://ghotimarket.com/amrweb/banner1.png";
    const currentUrl = window.location.href;

    document.title = title;
    document.querySelector('meta[name="description"]').setAttribute('content', desc);
    document.getElementById('og-title').setAttribute('content', title);
    document.getElementById('og-desc').setAttribute('content', desc);
    document.getElementById('og-image').setAttribute('content', image);
    document.getElementById('og-url').setAttribute('content', currentUrl);
    document.getElementById('tw-title').setAttribute('content', title);
    document.getElementById('tw-desc').setAttribute('content', desc);
    document.getElementById('tw-image').setAttribute('content', image);

    const schemaData = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": title,
        "description": desc,
        "url": currentUrl,
        "image": image
    };
    document.getElementById('structured-data').textContent = JSON.stringify(schemaData);
}

function renderCategoryHeader(category) {
    const headerSection = document.getElementById('gi-category-header-section');
    headerSection.innerHTML = `
        <img src="${category.categoryImage || 'https://ghotimarket.com/amrweb/banner1.png'}" alt="${escapeHtml(category.categoryName)}" onerror="this.src='https://ghotimarket.com/amrweb/banner1.png'">
        <div class="gi-category-info">
            <h1>${escapeHtml(category.categoryName)}</h1>
            <p>Browse products from this category</p>
        </div>
    `;
}

async function loadInitialProducts(categoryId) {
    try {
        const prodQuery = query(
            collection(db, "products"),
            where("categoryId", "==", categoryId),
            where("active", "==", true),
            limit(20)
        );
        const prodSnapshot = await getDocs(prodQuery);
        loadedProducts = [];
        
        prodSnapshot.forEach(docSnap => {
            loadedProducts.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (prodSnapshot.docs.length > 0) {
            lastVisibleDoc = prodSnapshot.docs[prodSnapshot.docs.length - 1];
        }

        allCategoryProducts = [...loadedProducts];
        renderProducts(loadedProducts);

        const loadMoreBtn = document.getElementById('gi-load-more-btn');
        if (prodSnapshot.docs.length === 20) {
            loadMoreBtn.classList.remove('gi-hidden');
            loadMoreBtn.onclick = loadMoreProducts;
        } else {
            if (loadedProducts.length > 0) {
                document.getElementById('gi-end-message').classList.remove('gi-hidden');
            }
        }
    } catch (error) {
        renderErrorState("Something went wrong", "We couldn't load the products right now. Please try again.", false, true);
    }
}

async function loadMoreProducts() {
    if (isLoadingMore || !lastVisibleDoc || !currentCategory) return;
    isLoadingMore = true;
    const btn = document.getElementById('gi-load-more-btn');
    btn.textContent = "LOADING...";
    btn.disabled = true;

    try {
        const prodQuery = query(
            collection(db, "products"),
            where("categoryId", "==", currentCategory.id),
            where("active", "==", true),
            startAfter(lastVisibleDoc),
            limit(20)
        );
        const prodSnapshot = await getDocs(prodQuery);
        
        const newProducts = [];
        prodSnapshot.forEach(docSnap => {
            newProducts.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (prodSnapshot.docs.length > 0) {
            lastVisibleDoc = prodSnapshot.docs[prodSnapshot.docs.length - 1];
            loadedProducts = [...loadedProducts, ...newProducts];
            allCategoryProducts = [...loadedProducts];
            renderProducts(loadedProducts);
        }

        if (prodSnapshot.docs.length < 20) {
            btn.classList.add('gi-hidden');
            document.getElementById('gi-end-message').classList.remove('gi-hidden');
        } else {
            btn.textContent = "LOAD MORE";
            btn.disabled = false;
        }
    } catch (error) {
        btn.textContent = "LOAD MORE";
        btn.disabled = false;
        showToast("Something went wrong. Please try again.");
    }
    isLoadingMore = false;
}

function renderProducts(products) {
    const grid = document.getElementById('gi-product-grid');
    const msgContainer = document.getElementById('gi-category-message-container');
    
    // Clear existing image sliders to prevent memory leaks
    Object.values(imageSliders).forEach(timer => clearInterval(timer));
    imageSliders = {};

    if (products.length === 0) {
        grid.innerHTML = '';
        msgContainer.innerHTML = `
            <h2>No Products Found</h2>
            <p>There are currently no products available in this category.</p>
            <a href="/all-product" class="gi-btn gi-btn-primary" style="display:inline-block; max-width: 200px; margin: 0 auto;">Browse All Products</a>
        `;
        msgContainer.classList.remove('gi-hidden');
        document.getElementById('gi-load-more-wrapper').classList.add('gi-hidden');
        return;
    }

    msgContainer.classList.add('gi-hidden');
    grid.innerHTML = '';

    products.forEach(product => {
        const card = createProductCard(product);
        grid.appendChild(card);
    });

    refreshProductCardsCartState();
}

function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'gi-product-card';
    card.setAttribute('data-product-id', product.id);

    const images = Array.isArray(product.productImage) && product.productImage.length > 0 
        ? product.productImage 
        : ['https://ghotimarket.com/amrweb/banner1.png'];
    const mainImg = images[0];

    let discountBadgeHTML = '';
    let priceHTML = '';
    const basePrice = Number(product.productPrice) || 0;
    const oldPrice = Number(product.oldPrice) || 0;

    if (oldPrice > basePrice) {
        const saveAmt = oldPrice - basePrice;
        const savePct = Math.round((saveAmt / oldPrice) * 100);
        discountBadgeHTML = `<div class="gi-discount-badge">${savePct}% OFF</div>`;
        priceHTML = `
            <span class="gi-current-price">৳${basePrice.toLocaleString()}</span>
            <span class="gi-old-price">৳${oldPrice.toLocaleString()}</span>
            <span class="gi-save-amount">Save ৳${saveAmt.toLocaleString()}</span>
        `;
    } else {
        priceHTML = `<span class="gi-current-price">৳${basePrice.toLocaleString()}</span>`;
    }

    // Variants HTML
    let variantsHTML = '';
    let selectedVariantsState = {};
    if (Array.isArray(product.variants) && product.variants.length > 0) {
        variantsHTML = '<div class="gi-variant-container">';
        product.variants.forEach((group, groupIdx) => {
            variantsHTML += `
                <div class="gi-variant-group" data-variant-group="${escapeHtml(group.name)}">
                    <span class="gi-variant-label">${escapeHtml(group.name)}</span>
                    <div class="gi-variant-options">
            `;
            group.values.forEach((val, valIdx) => {
                const isDefault = valIdx === 0;
                if (isDefault) {
                    if (!selectedVariantsState[group.name]) {
                        selectedVariantsState[group.name] = { value: val.value, extraPrice: Number(val.extraPrice) || 0 };
                    }
                }
                const extraText = val.extraPrice && Number(val.extraPrice) > 0 ? ` +৳${val.extraPrice}` : '';
                const selectedClass = isDefault ? 'selected' : '';
                variantsHTML += `
                    <button type="button" class="gi-variant-btn ${selectedClass}" data-group="${escapeHtml(group.name)}" data-value="${escapeHtml(val.value)}" data-extra="${val.extraPrice || 0}">
                        ${escapeHtml(val.value)}${extraText}
                    </button>
                `;
            });
            variantsHTML += `</div></div>`;
        });
        variantsHTML += '</div>';
    }

    card.innerHTML = `
        <div class="gi-card-img-container" onclick="window.location.href='/product?${escapeHtml(product.productSlug)}'">
            ${discountBadgeHTML}
            <img src="${escapeHtml(mainImg)}" alt="${escapeHtml(product.productName)}" loading="lazy" decoding="async" onerror="this.src='https://ghotimarket.com/amrweb/banner1.png'" data-img-index="0">
        </div>
        <div class="gi-card-body">
            <h3 class="gi-product-title" onclick="window.location.href='/product?${escapeHtml(product.productSlug)}'">${escapeHtml(product.productName)}</h3>
            <div class="gi-price-row gi-dynamic-price">
                ${priceHTML}
            </div>
            ${variantsHTML}
            <div class="gi-qty-row">
                <span class="gi-qty-label">Quantity</span>
                <div class="gi-qty-controls">
                    <button type="button" class="gi-qty-btn gi-qty-minus">−</button>
                    <span class="gi-qty-val">1</span>
                    <button type="button" class="gi-qty-btn gi-qty-plus">+</button>
                </div>
            </div>
            <div class="gi-card-actions">
                <button type="button" class="gi-btn gi-btn-primary gi-add-to-cart-btn">Add to Cart</button>
                <button type="button" class="gi-btn gi-btn-outline gi-buy-now-btn">Buy Now</button>
            </div>
        </div>
    `;

    // Store state on element
    card._productData = product;
    card._selectedVariants = selectedVariantsState;
    card._quantity = 1;

    // Auto image swipe if multiple images
    if (images.length > 1) {
        let currentIdx = 0;
        const imgEl = card.querySelector('.gi-card-img-container img');
        const timer = setInterval(() => {
            currentIdx = (currentIdx + 1) % images.length;
            imgEl.src = images[currentIdx];
        }, 3500);
        imageSliders[product.id] = timer;
    }

    // Attach Variant Listeners
    if (product.variants && product.variants.length > 0) {
        card.querySelectorAll('.gi-variant-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const groupName = btn.getAttribute('data-group');
                const valName = btn.getAttribute('data-value');
                const extraPrice = Number(btn.getAttribute('data-extra')) || 0;

                card.querySelectorAll(`.gi-variant-btn[data-group="${groupName}"]`).forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');

                card._selectedVariants[groupName] = { value: valName, extraPrice: extraPrice };
                updateCardPriceDisplay(card);
            });
        });
    }

    // Quantity Listeners
    const minusBtn = card.querySelector('.gi-qty-minus');
    const plusBtn = card.querySelector('.gi-qty-plus');
    const qtyValEl = card.querySelector('.gi-qty-val');

    minusBtn.addEventListener('click', () => {
        if (card._quantity > 1) {
            card._quantity--;
            qtyValEl.textContent = card._quantity;
        }
    });

    plusBtn.addEventListener('click', () => {
        card._quantity++;
        qtyValEl.textContent = card._quantity;
    });

    // Add to Cart Action
    card.querySelector('.gi-add-to-cart-btn').addEventListener('click', () => {
        handleAddToCart(card);
    });

    // Buy Now Action
    card.querySelector('.gi-buy-now-btn').addEventListener('click', () => {
        handleBuyNow(card);
    });

    return card;
}

function updateCardPriceDisplay(card) {
    const product = card._productData;
    const basePrice = Number(product.productPrice) || 0;
    let extraSum = 0;
    Object.values(card._selectedVariants).forEach(v => {
        extraSum += Number(v.extraPrice) || 0;
    });
    const finalPrice = basePrice + extraSum;
    const priceRow = card.querySelector('.gi-dynamic-price');
    const oldPrice = Number(product.oldPrice) || 0;

    if (oldPrice > basePrice) {
        const saveAmt = (oldPrice - basePrice) + extraSum; // maintaining differential or absolute base
        priceRow.innerHTML = `
            <span class="gi-current-price">৳${finalPrice.toLocaleString()}</span>
            <span class="gi-old-price">৳${(oldPrice + extraSum).toLocaleString()}</span>
            <span class="gi-save-amount">Save ৳${saveAmt.toLocaleString()}</span>
        `;
    } else {
        priceRow.innerHTML = `<span class="gi-current-price">৳${finalPrice.toLocaleString()}</span>`;
    }
}

function validateVariantsSelected(card) {
    const product = card._productData;
    if (!product.variants || product.variants.length === 0) return true;
    for (let group of product.variants) {
        if (!card._selectedVariants[group.name]) {
            return false;
        }
    }
    return true;
}

async function handleAddToCart(card) {
    if (!validateVariantsSelected(card)) {
        showToast("Please select all product options before continuing.");
        return;
    }

    if (!currentUser) {
        openAuthModal(() => handleAddToCart(card));
        return;
    }

    await saveCartItemToFirestore(card, false);
}

async function handleBuyNow(card) {
    if (!validateVariantsSelected(card)) {
        showToast("Please select all product options before continuing.");
        return;
    }

    if (!currentUser) {
        openAuthModal(() => handleBuyNow(card));
        return;
    }

    await saveCartItemToFirestore(card, true);
}

async function saveCartItemToFirestore(card, isBuyNow) {
    const product = card._productData;
    const basePrice = Number(product.productPrice) || 0;
    let extraSum = 0;
    Object.values(card._selectedVariants).forEach(v => {
        extraSum += Number(v.extraPrice) || 0;
    });
    const finalUnitPrice = basePrice + extraSum;
    const quantity = card._quantity;

    const newItem = {
        productId: product.id,
        productName: product.productName,
        productSlug: product.productSlug,
        productImage: Array.isArray(product.productImage) && product.productImage.length > 0 ? product.productImage[0] : '',
        productPrice: basePrice,
        selectedVariants: card._selectedVariants,
        quantity: quantity,
        unitPrice: finalUnitPrice,
        totalPrice: finalUnitPrice * quantity,
        SKU: product.SKU || '',
        categoryId: product.categoryId || '',
        freeDelivery: !!product.freeDelivery,
        addedAt: new Date().toISOString()
    };

    try {
        const existingIndex = cartItems.findIndex(item => item.productId === product.id);
        if (existingIndex > -1) {
            // Update existing
            cartItems[existingIndex] = {
                ...cartItems[existingIndex],
                selectedVariants: card._selectedVariants,
                unitPrice: finalUnitPrice,
                totalPrice: finalUnitPrice * quantity,
                quantity: quantity,
                updatedAt: new Date().toISOString()
            };
        } else {
            cartItems.push(newItem);
        }

        const cartRef = doc(db, "carts", currentUser.uid);
        await setDoc(cartRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            updatedAt: new Date().toISOString(),
            items: cartItems
        }, { merge: true });

        updateCartBadge();
        refreshProductCardsCartState();

        if (isBuyNow) {
            window.location.href = "/checkout";
        } else {
            showToast("Added to cart successfully.");
        }
    } catch (error) {
        showToast("Something went wrong. Please try again.");
    }
}

function refreshProductCardsCartState() {
    const cards = document.querySelectorAll('.gi-product-card');
    cards.forEach(card => {
        const productId = card.getAttribute('data-product-id');
        const inCart = cartItems.some(item => item.productId === productId);
        const addBtn = card.querySelector('.gi-add-to-cart-btn');
        
        if (inCart) {
            addBtn.textContent = "This product already added from cart!";
            addBtn.className = "gi-btn gi-btn-disabled";
            addBtn.disabled = true;
        } else {
            addBtn.textContent = "Add to Cart";
            addBtn.className = "gi-btn gi-btn-primary gi-add-to-cart-btn";
            addBtn.disabled = false;
        }
    });
}

// Search Feature
function setupSearchListener() {
    const searchInput = document.getElementById('gi-category-search-input');
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const queryText = e.target.value.toLowerCase().trim();
        
        searchTimeout = setTimeout(() => {
            if (!queryText) {
                renderProducts(allCategoryProducts);
                return;
            }

            const filtered = allCategoryProducts.filter(p => {
                const nameMatch = p.productName && p.productName.toLowerCase().includes(queryText);
                const descMatch = p.productDescription && p.productDescription.toLowerCase().includes(queryText);
                const skuMatch = p.SKU && p.SKU.toLowerCase().includes(queryText);
                return nameMatch || descMatch || skuMatch;
            });

            renderProductsFiltered(filtered);
        }, 300);
    });
}

function renderProductsFiltered(products) {
    const grid = document.getElementById('gi-product-grid');
    const msgContainer = document.getElementById('gi-category-message-container');
    document.getElementById('gi-load-more-wrapper').classList.add('gi-hidden');

    Object.values(imageSliders).forEach(timer => clearInterval(timer));
    imageSliders = {};

    if (products.length === 0) {
        grid.innerHTML = '';
        msgContainer.innerHTML = `
            <h2>No Matching Products Found</h2>
            <p>No products match your search query in this category.</p>
        `;
        msgContainer.classList.remove('gi-hidden');
        return;
    }

    msgContainer.classList.add('gi-hidden');
    grid.innerHTML = '';
    products.forEach(product => {
        const card = createProductCard(product);
        grid.appendChild(card);
    });
    refreshProductCardsCartState();
}

// Auth Modal Management
let pendingActionAfterLogin = null;

function openAuthModal(callback) {
    pendingActionAfterLogin = callback;
    document.getElementById('gi-auth-modal').classList.remove('gi-hidden');
}

function closeAuthModal() {
    document.getElementById('gi-auth-modal').classList.add('gi-hidden');
    pendingActionAfterLogin = null;
}

function setupAuthModalListeners() {
    const modal = document.getElementById('gi-auth-modal');
    document.getElementById('gi-modal-close-btn').addEventListener('click', () => {
        closeAuthModal();
        showToast("Sign in was cancelled.");
    });

    document.getElementById('gi-google-signin-btn').addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            currentUser = result.user;
            closeAuthModal();
            await fetchUserCart();
            if (pendingActionAfterLogin) {
                pendingActionAfterLogin();
                pendingActionAfterLogin = null;
            }
        } catch (error) {
            closeAuthModal();
            showToast("Sign in was cancelled.");
        }
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeAuthModal();
            showToast("Sign in was cancelled.");
        }
    });
}

// Error Rendering State
function renderErrorState(title, message, isNotFound = false, isRetryable = false) {
    const grid = document.getElementById('gi-product-grid');
    const msgContainer = document.getElementById('gi-category-message-container');
    document.getElementById('gi-category-header-section').classList.add('gi-hidden');
    document.querySelector('.gi-search-section').classList.add('gi-hidden');
    document.getElementById('gi-load-more-wrapper').classList.add('gi-hidden');
    grid.innerHTML = '';

    let actionBtnHTML = '';
    if (isNotFound) {
        actionBtnHTML = `<a href="/all-product" class="gi-btn gi-btn-primary" style="display:inline-block; max-width: 200px; margin: 0 auto;">View All Products</a>`;
    } else if (isRetryable) {
        actionBtnHTML = `<button onclick="window.location.reload()" class="gi-btn gi-btn-primary" style="max-width: 200px; margin: 0 auto;">Retry</button>`;
    }

    msgContainer.innerHTML = `
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
        ${actionBtnHTML}
    `;
    msgContainer.classList.remove('gi-hidden');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
