import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    updateCode, // fallback safeguard
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ================= 1. FIREBASE CONFIGURATION =================
// Using existing Firebase project configuration architecture
const firebaseConfig = {
    apiKey: "AIzaSyD-placeholder-key-ghotimarket",
    authDomain: "store.ghotimarket.com",
    projectId: "ghotimarket-store",
    storageBucket: "ghotimarket-store.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

// ================= GLOBAL APP STATE =================
let currentProduct = null;
let currentProductId = null;
let currentCategoryObj = null;
let selectedVariantsState = {};
let currentQuantity = 1;
let currentImageIndex = 0;
let countdownInterval = null;
let pendingAction = null;
let isSignupMode = false;

// ================= 2. ROBUST SLUG EXTRACTION =================
function extractProductSlug() {
    const searchStr = window.location.search;
    if (!searchStr) return null;

    // Remove leading '?'
    let cleanQuery = searchStr.startsWith('?') ? searchStr.substring(1) : searchStr;

    // Split parameters by '&' or ';'
    const params = cleanQuery.split(/[&;]/);
    let rawSlugKey = null;

    const trackingParams = ['fbclid', 'gclid', 'dclid', 'msclkid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

    for (let param of params) {
        let parts = param.split('=');
        let key = decodeURIComponent(parts[0] || '').trim();
        let value = decodeURIComponent(parts[1] || '').trim();

        // If key is a tracking parameter, ignore it
        if (trackingParams.includes(key.toLowerCase())) {
            continue;
        }

        // The first non-tracking parameter key is our potential slug source
        if (key) {
            rawSlugKey = key;
            break;
        }
    }

    if (!rawSlugKey) return null;

    // Remove accidental trailing '=' if any got caught
    rawSlugKey = rawSlugKey.replace(/=+$/, '').trim();

    return rawSlugKey;
}

// ================= 3. INITIALIZATION & ROUTING =================
document.addEventListener("DOMContentLoaded", async () => {
    initAuthListener();
    initUIEventListeners();

    const extractedSlug = extractProductSlug();
    if (!extractedSlug) {
        showErrorState("Invalid Product Link", "The product link is invalid or missing required parameters.", "/all-product");
        return;
    }

    await loadProductData(extractedSlug);
});

// ================= 4. PRODUCT FETCHING & VALIDATION =================
async function loadProductData(slug) {
    try {
        showLoadingState(true);

        // Slug resolution rule: support -true suffix (try exact, then strip -true)
        let slugsToTry = [slug];
        if (slug.endsWith('-true')) {
            const stripped = slug.replace(/-true$/, '');
            if (stripped && !slugsToTry.includes(stripped)) {
                slugsToTry.push(stripped);
            }
        }

        let docSnap = null;
        let matchedSlug = null;

        for (let testSlug of slugsToTry) {
            const q = query(collection(db, "products"), where("productSlug", "==", testSlug));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                docSnap = querySnapshot.docs[0];
                matchedSlug = testSlug;
                break;
            }
        }

        if (!docSnap || !docSnap.exists()) {
            showErrorState("Product Not Found", "The requested product does not exist in our catalog.", "/all-product");
            return;
        }

        currentProductId = docSnap.id;
        currentProduct = docSnap.data();

        // Category Lookup
        if (currentProduct.categoryId) {
            try {
                const catDocRef = doc(db, "categories", currentProduct.categoryId);
                const catDocSnap = await getDoc(catDocRef);
                if (catDocSnap.exists()) {
                    currentCategoryObj = catDocSnap.data();
                }
            } catch (err) {
                console.warn("Could not fetch category document:", err);
            }
        }

        renderProductPage();
        showLoadingState(false);

        // Check pending actions after product load & auth check
        checkAndExecutePendingAction();

    } catch (error) {
        console.error("Error loading product:", error);
        showErrorState("Unable to load this product.", "An error occurred while fetching product data. Please try again.", null, true);
    }
}

// ================= 5. RENDERING PRODUCT UI =================
function renderProductPage() {
    if (!currentProduct) return;

    // Active Status Check
    const isActive = currentProduct.active === true;
    const activeActionsEl = document.getElementById("activeProductActions");
    const inactiveNoticeEl = document.getElementById("inactiveProductNotice");

    if (isActive) {
        activeActionsEl.classList.remove("hidden");
        inactiveNoticeEl.classList.add("hidden");
    } else {
        activeActionsEl.classList.add("hidden");
        inactiveNoticeEl.classList.remove("hidden");
    }

    // Dynamic SEO & Document Title
    const prodName = currentProduct.productName || "Product";
    document.title = `${prodName} | Gadgets Item`;

    const descriptionText = currentProduct.productDescription ? currentProduct.productDescription.substring(0, 150) : "Explore top gadgets and accessories.";
    const primaryImg = (currentProduct.productImage && currentProduct.productImage.length > 0) ? currentProduct.productImage[0] : "https://ghotimarket.com/banner1.png";

    updateMetaTag('name', 'description', descriptionText);
    updateMetaTag('property', 'og:title', `${prodName} | Gadgets Item`);
    updateMetaTag('property', 'og:description', descriptionText);
    updateMetaTag('property', 'og:image', primaryImg);
    updateMetaTag('property', 'og:url', window.location.href);
    updateMetaTag('name', 'twitter:title', `${prodName} | Gadgets Item`);
    updateMetaTag('name', 'twitter:description', descriptionText);
    updateMetaTag('name', 'twitter:image', primaryImg);

    const canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonicalEl) canonicalEl.setAttribute('href', window.location.href);

    // Render Category
    const categoryName = currentCategoryObj?.categoryName || currentProduct.categoryName || "General";
    document.getElementById("productCategoryBadge").textContent = categoryName;

    // Render Title & SKU
    document.getElementById("productTitle").textContent = prodName;
    document.getElementById("productSku").textContent = currentProduct.SKU || "N/A";

    // Warranty
    const warrantyEl = document.getElementById("productWarranty");
    const warrantyWrapper = document.getElementById("warrantyBadgeWrapper");
    if (currentProduct.warranty) {
        warrantyEl.textContent = currentProduct.warranty;
        warrantyWrapper.style.display = "inline-flex";
    } else {
        warrantyWrapper.style.display = "none";
    }

    // Free Delivery
    const deliveryRow = document.getElementById("deliveryStatusRow");
    if (currentProduct.freeDelivery === true) {
        deliveryRow.style.display = "flex";
    } else {
        deliveryRow.style.display = "none";
    }

    // Image Gallery
    renderImageGallery(currentProduct.productImage);

    // Variants
    renderVariants(currentProduct.variants);

    // Price and Discount Calculation
    updateCalculatedPriceAndDiscounts();

    // Offer Countdown
    setupOfferCountdown(currentProduct.offerTime);

    // Description & Video
    const descCard = document.getElementById("descriptionCardWrapper");
    const descContent = document.getElementById("productDescriptionContent");
    if (currentProduct.productDescription) {
        descContent.innerHTML = escapeHtml(currentProduct.productDescription).replace(/\n/g, '<br>');
        descCard.style.display = "block";
    } else {
        descCard.style.display = "none";
    }

    const videoCard = document.getElementById("videoCardWrapper");
    const videoIframe = document.getElementById("productVideoIframe");
    if (currentProduct.videoLink && isValidHttpUrl(currentProduct.videoLink)) {
        videoIframe.src = currentProduct.videoLink;
        videoCard.style.display = "block";
    } else {
        videoCard.style.display = "none";
    }

    // Structured Data (JSON-LD)
    injectStructuredData(prodName, primaryImg, descriptionText, currentProduct.SKU, categoryName);
}

// ================= 6. IMAGE GALLERY LOGIC =================
function renderImageGallery(images) {
    const mainImg = document.getElementById("mainProductImage");
    const thumbStrip = document.getElementById("thumbnailStrip");
    const prevBtn = document.getElementById("prevImageBtn");
    const nextBtn = document.getElementById("nextImageBtn");

    if (!images || !Array.isArray(images) || images.length === 0) {
        mainImg.src = "https://ghotimarket.com/banner1.png";
        thumbStrip.innerHTML = "";
        prevBtn.style.display = "none";
        nextBtn.style.display = "none";
        return;
    }

    currentImageIndex = 0;
    mainImg.src = images[0];
    mainImg.alt = currentProduct.productName || "Product Image";

    if (images.length <= 1) {
        prevBtn.style.display = "none";
        nextBtn.style.display = "none";
        thumbStrip.style.display = "none";
        return;
    }

    prevBtn.style.display = "flex";
    nextBtn.style.display = "flex";
    thumbStrip.style.display = "flex";

    thumbStrip.innerHTML = "";
    images.forEach((imgUrl, idx) => {
        const thumb = document.createElement("div");
        thumb.className = `thumbnail-item ${idx === 0 ? 'active' : ''}`;
        thumb.innerHTML = `<img src="${escapeHtml(imgUrl)}" alt="Thumbnail ${idx + 1}" loading="lazy">`;
        thumb.addEventListener("click", () => {
            setMainImage(idx, images);
        });
        thumbStrip.appendChild(thumb);
    });

    prevBtn.onclick = () => {
        let newIdx = (currentImageIndex - 1 + images.length) % images.length;
        setMainImage(newIdx, images);
    };

    nextBtn.onclick = () => {
        let newIdx = (currentImageIndex + 1) % images.length;
        setMainImage(newIdx, images);
    };
}

function setMainImage(index, images) {
    currentImageIndex = index;
    const mainImg = document.getElementById("mainProductImage");
    mainImg.style.opacity = "0.4";
    setTimeout(() => {
        mainImg.src = images[index];
        mainImg.style.opacity = "1";
    }, 150);

    const thumbs = document.querySelectorAll(".thumbnail-item");
    thumbs.forEach((th, idx) => {
        if (idx === index) th.classList.add("active");
        else th.classList.remove("active");
    });
}

// ================= 7. VARIANTS & PRICING LOGIC =================
function renderVariants(variants) {
    const container = document.getElementById("variantsContainer");
    container.innerHTML = "";
    selectedVariantsState = {};

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
        container.style.display = "none";
        return;
    }

    container.style.display = "flex";

    variants.forEach((variantGroup, groupIndex) => {
        const groupName = variantGroup.name || `Option ${groupIndex + 1}`;
        selectedVariantsState[groupName] = null;

        const groupDiv = document.createElement("div");
        groupDiv.className = "variant-group";

        const titleEl = document.createElement("div");
        titleEl.className = "variant-group-title";
        titleEl.textContent = groupName;
        groupDiv.appendChild(titleEl);

        const optionsList = document.createElement("div");
        optionsList.className = "variant-options-list";

        if (variantGroup.values && Array.isArray(variantGroup.values)) {
            variantGroup.values.forEach((valObj, valIndex) => {
                const valName = valObj.value || valObj;
                const extraPrice = Number(valObj.extraPrice) || 0;

                const chip = document.createElement("button");
                chip.type = "button";
                chip.className = `variant-chip ${valIndex === 0 ? 'selected' : ''}`;
                
                let chipText = escapeHtml(valName);
                if (extraPrice > 0) {
                    chipText += ` +৳${extraPrice}`;
                }

                chip.innerHTML = valIndex === 0 
                    ? `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>${chipText}`
                    : chipText;

                if (valIndex === 0) {
                    selectedVariantsState[groupName] = { value: valName, extraPrice: extraPrice };
                }

                chip.addEventListener("click", () => {
                    optionsList.querySelectorAll(".variant-chip").forEach(c => {
                        c.classList.remove("selected");
                        c.innerHTML = c.textContent.replace(/^[✓\s]+/, ''); // Clean old check
                    });

                    chip.classList.add("selected");
                    chip.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>${chipText}`;

                    selectedVariantsState[groupName] = { value: valName, extraPrice: extraPrice };
                    updateCalculatedPriceAndDiscounts();
                });

                optionsList.appendChild(chip);
            });
        }

        groupDiv.appendChild(optionsList);
        container.appendChild(groupDiv);
    });
}

function calculateFinalUnitPrice() {
    let basePrice = Number(currentProduct?.productPrice) || 0;
    let totalExtra = 0;

    for (let group in selectedVariantsState) {
        if (selectedVariantsState[group] && typeof selectedVariantsState[group].extraPrice === 'number') {
            totalExtra += selectedVariantsState[group].extraPrice;
        }
    }

    return basePrice + totalExtra;
}

function updateCalculatedPriceAndDiscounts() {
    if (!currentProduct) return;

    const unitPrice = calculateFinalUnitPrice();
    const oldPrice = Number(currentProduct.oldPrice) || 0;

    document.getElementById("currentPriceDisplay").textContent = `৳${formatNumber(unitPrice)}`;

    const oldPriceEl = document.getElementById("oldPriceDisplay");
    const discountEl = document.getElementById("discountBadge");
    const saveEl = document.getElementById("saveAmountDisplay");

    if (oldPrice > unitPrice) {
        const discountPercentage = Math.round(((oldPrice - unitPrice) / oldPrice) * 100);
        const saveAmount = oldPrice - unitPrice;

        oldPriceEl.textContent = `৳${formatNumber(oldPrice)}`;
        oldPriceEl.style.display = "inline";

        discountEl.textContent = `${discountPercentage}% OFF`;
        discountEl.style.display = "inline-block";

        saveEl.textContent = `Save ৳${formatNumber(saveAmount)}`;
        saveEl.style.display = "block";
    } else {
        oldPriceEl.style.display = "none";
        discountEl.style.display = "none";
        saveEl.style.display = "none";
    }
}

// ================= 8. QUANTITY SELECTOR LOGIC =================
const decreaseBtn = document.getElementById("decreaseQtyBtn");
const increaseBtn = document.getElementById("increaseQtyBtn");
const qtyDisplay = document.getElementById("productQuantityDisplay");

decreaseBtn.addEventListener("click", () => {
    if (currentQuantity > 1) {
        currentQuantity--;
        qtyDisplay.textContent = currentQuantity;
    }
});

increaseBtn.addEventListener("click", () => {
    currentQuantity++;
    qtyDisplay.textContent = currentQuantity;
});

// ================= 9. OFFER COUNTDOWN TIMER =================
function setupOfferCountdown(offerTime) {
    const box = document.getElementById("offerCountdownBox");
    const valuesEl = document.getElementById("countdownValues");

    if (!offerTime || typeof offerTime !== 'number' || offerTime <= Date.now()) {
        box.style.display = "none";
        return;
    }

    box.style.display = "block";

    if (countdownInterval) clearInterval(countdownInterval);

    function updateTimer() {
        const now = Date.now();
        const diff = offerTime - now;

        if (diff <= 0) {
            box.style.display = "none";
            if (countdownInterval) clearInterval(countdownInterval);
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const pad = (n) => String(n).padStart(2, '0');
        valuesEl.textContent = `${pad(days)} Days ${pad(hours)} Hours ${pad(minutes)} Minutes ${pad(seconds)} Seconds`;
    }

    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
}

// ================= 10. AUTHENTICATION & CART OPERATIONS =================
let currentUser = null;

function initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        updateHeaderCartCount();
        if (user) {
            closeAuthModal();
        }
    });
}

document.getElementById("addToCartBtn").addEventListener("click", () => {
    handleCartAction("addToCart");
});

document.getElementById("buyNowBtn").addEventListener("click", () => {
    handleCartAction("buyNow");
});

async function handleCartAction(actionType) {
    if (!currentProduct || !currentProductId) return;

    if (!currentUser) {
        // Save pending action in sessionStorage
        pendingAction = {
            action: actionType,
            productId: currentProductId,
            quantity: currentQuantity,
            variants: selectedVariantsState
        };
        sessionStorage.setItem("pendingProductAction", JSON.stringify(pendingAction));
        openAuthModal();
        return;
    }

    await executeCartOperation(actionType, currentUser);
}

async function executeCartOperation(actionType, user) {
    try {
        const unitPrice = calculateFinalUnitPrice();
        const totalPrice = unitPrice * currentQuantity;
        const productImage = (currentProduct.productImage && currentProduct.productImage.length > 0) ? currentProduct.productImage[0] : "";

        // Check user's cart in Firestore carts collection
        const cartsQuery = query(collection(db, "carts"), where("uid", "==", user.uid));
        const cartsSnapshot = await getDocs(cartsQuery);

        let cartDocRef;
        let cartData = { uid: user.uid, email: user.email, items: [] };

        if (!cartsSnapshot.empty) {
            const existingCartDoc = cartsSnapshot.docs[0];
            cartDocRef = doc(db, "carts", existingCartDoc.id);
            cartData = existingCartDoc.data();
            if (!cartData.items) cartData.items = [];
        } else {
            cartDocRef = doc(collection(db, "carts"));
        }

        // Check if product with exact variants already exists in cart
        const existingItemIndex = cartData.items.findIndex(item => item.productId === currentProductId);

        if (existingItemIndex !== -1) {
            // Already in cart
            if (actionType === "addToCart") {
                showToastNotification("Already cart added");
                return;
            }
        } else {
            const newItem = {
                productId: currentProductId,
                productName: currentProduct.productName || "Product",
                productSlug: currentProduct.productSlug || "",
                productImage: productImage,
                selectedVariants: selectedVariantsState,
                quantity: currentQuantity,
                unitPrice: unitPrice,
                totalPrice: totalPrice,
                addedAt: serverTimestamp()
            };
            cartData.items.push(newItem);
            await setDoc(cartDocRef, cartData, { merge: true });
            updateHeaderCartCount();
            showToastNotification("Product added to cart successfully");
        }

        if (actionType === "buyNow") {
            window.location.href = "/checkout";
        }

    } catch (err) {
        console.error("Cart operation error:", err);
        showAuthErrorBanner("Unable to add this product to cart. Please try again.");
    }
}

async function updateHeaderCartCount() {
    const badge = document.getElementById("headerCartCount");
    if (!currentUser) {
        badge.textContent = "0";
        return;
    }
    try {
        const q = query(collection(db, "carts"), where("uid", "==", currentUser.uid));
        const snap = await getDocs(q);
        let count = 0;
        if (!snap.empty) {
            const data = snap.docs[0].data();
            if (data.items && Array.isArray(data.items)) {
                count = data.items.length;
            }
        }
        badge.textContent = count;
    } catch (err) {
        console.error("Error fetching cart count:", err);
        badge.textContent = "0";
    }
}

async function checkAndExecutePendingAction() {
    const storedActionStr = sessionStorage.getItem("pendingProductAction");
    if (!storedActionStr || !currentUser) return;

    try {
        const actionObj = JSON.parse(storedActionStr);
        sessionStorage.removeItem("pendingProductAction");

        if (actionObj && actionObj.productId === currentProductId) {
            currentQuantity = actionObj.quantity || 1;
            document.getElementById("productQuantityDisplay").textContent = currentQuantity;
            await executeCartOperation(actionObj.action, currentUser);
        }
    } catch (err) {
        console.error("Error executing pending action:", err);
    }
}

// ================= 11. AUTH MODAL & FORM LOGIC =================
const authModalOverlay = document.getElementById("authModalOverlay");
const authCloseBtn = document.getElementById("authCloseBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const emailAuthForm = document.getElementById("emailAuthForm");
const authToggleLink = document.getElementById("authToggleLink");
const authToggleText = document.getElementById("authToggleText");
const confirmPasswordGroup = document.getElementById("confirmPasswordGroup");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authErrorBanner = document.getElementById("authErrorBanner");

function openAuthModal() {
    authModalOverlay.classList.remove("hidden");
}

function closeAuthModal() {
    authModalOverlay.classList.add("hidden");
    authErrorBanner.classList.add("hidden");
}

authCloseBtn.addEventListener("click", closeAuthModal);
authModalOverlay.addEventListener("click", (e) => {
    if (e.target === authModalOverlay) closeAuthModal();
});

authToggleLink.addEventListener("click", () => {
    isSignupMode = !isSignupMode;
    if (isSignupMode) {
        authSubmitBtn.textContent = "Sign Up";
        authToggleText.textContent = "Already have an account?";
        authToggleLink.textContent = "Login";
        confirmPasswordGroup.classList.remove("hidden");
    } else {
        authSubmitBtn.textContent = "Login";
        authToggleText.textContent = "Don't have an account?";
        authToggleLink.textContent = "Sign Up";
        confirmPasswordGroup.classList.add("hidden");
    }
});

googleLoginBtn.addEventListener("click", async () => {
    try {
        authErrorBanner.classList.add("hidden");
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        closeAuthModal();
    } catch (err) {
        console.error("Google auth error:", err);
        showAuthErrorBanner("Google authentication failed. Please try again.");
    }
});

emailAuthForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authErrorBanner.classList.add("hidden");

    const email = document.getElementById("authEmailInput").value.trim();
    const password = document.getElementById("authPasswordInput").value;

    if (!email || !password) {
        showAuthErrorBanner("Please fill in all fields.");
        return;
    }

    try {
        if (isSignupMode) {
            const confirmPass = document.getElementById("authConfirmPasswordInput").value;
            if (password !== confirmPass) {
                showAuthErrorBanner("Passwords do not match.");
                return;
            }
            await createUserWithEmailAndPassword(auth, email, password);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
        closeAuthModal();
    } catch (err) {
        console.error("Email auth error:", err);
        showAuthErrorBanner(getFriendlyAuthErrorMessage(err.code));
    }
});

function showAuthErrorBanner(msg) {
    authErrorBanner.textContent = msg;
    authErrorBanner.classList.remove("hidden");
}

function getFriendlyAuthErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-email': return 'Please enter a valid email address.';
        case 'auth/user-not-found': return 'No account found with this email.';
        case 'auth/wrong-password': return 'Incorrect password. Please try again.';
        case 'auth/email-already-in-use': return 'An account with this email already exists.';
        case 'auth/weak-password': return 'Password should be at least 6 characters.';
        default: return 'Authentication failed. Please check your credentials.';
    }
}

// ================= 12. UTILITY & UI HELPERS =================
function showLoadingState(isLoading) {
    const skeleton = document.getElementById("loadingSkeleton");
    const container = document.getElementById("productContainer");
    const errorState = document.getElementById("errorState");

    errorState.classList.add("hidden");
    if (isLoading) {
        skeleton.classList.remove("hidden");
        container.classList.add("hidden");
    } else {
        skeleton.classList.add("hidden");
        container.classList.remove("hidden");
    }
}

function showErrorState(title, message, redirectUrl = "/all-product", showRetry = false) {
    showLoadingState(false);
    document.getElementById("productContainer").classList.add("hidden");
    const errorState = document.getElementById("errorState");
    errorState.classList.remove("hidden");

    document.getElementById("errorTitle").textContent = title;
    document.getElementById("errorMessage").textContent = message;

    const actionBtn = document.getElementById("errorActionBtn");
    if (showRetry) {
        actionBtn.textContent = "Try Again";
        actionBtn.onclick = () => window.location.reload();
        actionBtn.removeAttribute("href");
    } else {
        actionBtn.textContent = "Browse All Products";
        actionBtn.href = redirectUrl;
        actionBtn.onclick = null;
    }
}

function showToastNotification(message) {
    let existingToast = document.getElementById("toastNotification");
    if (existingToast) existingToast.remove();

    const toast = document.createElement("div");
    toast.id = "toastNotification";
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #111827;
        color: #ffffff;
        padding: 10px 20px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 14px;
        z-index: 2000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: fadeInOut 2.5s ease forwards;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast) toast.remove();
    }, 2500);
}

function updateMetaTag(attrName, attrValue, content) {
    let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (element) {
        element.setAttribute("content", content);
    }
}

function injectStructuredData(name, image, description, sku, category) {
    let scriptTag = document.getElementById("productStructuredData");
    if (!scriptTag) {
        scriptTag = document.createElement("script");
        scriptTag.id = "productStructuredData";
        scriptTag.type = "application/ld+json";
        document.head.appendChild(scriptTag);
    }

    const unitPrice = calculateFinalUnitPrice();
    const availability = (currentProduct && currentProduct.active) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

    const schemaObj = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": name,
        "image": [image],
        "description": description,
        "sku": sku || "",
        "category": category,
        "brand": {
            "@type": "Brand",
            "name": "Gadgets Item"
        },
        "offers": {
            "@type": "Offer",
            "url": window.location.href,
            "priceCurrency": "BDT",
            "price": unitPrice,
            "availability": availability
        }
    };

    scriptTag.textContent = JSON.stringify(schemaObj);
}

function formatNumber(num) {
    return Number(num).toLocaleString('en-BD');
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

function isValidHttpUrl(string) {
    let url;
    try {
        url = new URL(string);
    } catch (_) {
        return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
}

function initUIEventListeners() {
    // Additional UI event listeners can be attached here if needed
}
