import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, query, where, getDocs, doc, setDoc, getDoc, limit 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

// --- State Variables ---
let currentProduct = null;
let currentQuantity = 1;
let selectedVariants = {};
let currentImageIndex = 0;
let slideInterval = null;
let currentUser = null;
let pendingAction = null; // 'cart' or 'buy'

// SVG Checkmark Icon (Reusable)
const SVG_CHECK = `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const SVG_ERROR = `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

// --- DOM Elements ---
const skeletonLoader = document.getElementById('skeletonLoader');
const productContent = document.getElementById('productContent');
const descriptionCard = document.getElementById('descriptionCard');
const statusCard = document.getElementById('statusCard');
const statusTitle = document.getElementById('statusTitle');
const statusMessage = document.getElementById('statusMessage');
const statusIcon = document.getElementById('statusIcon');
const cartBadge = document.getElementById('cartBadge');
const authModal = document.getElementById('authModal');
const addToCartBtn = document.getElementById('addToCartBtn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  setupAuthObserver();
  setupEventListeners();

  const slug = extractSlugFromURL();
  if (!slug) {
    showStatusState("Missing Product", "The correct slug or ID was not found.");
    await loadSuggestedProducts(null);
    return;
  }

  const product = await fetchProductBySlug(slug);
  if (!product) {
    showStatusState("Product Not Found", "This product was not found or has been deleted.");
    await loadSuggestedProducts(null);
    return;
  }

  if (!product.active) {
    showStatusState("Unavailable", "This product is currently unavailable. You can explore other products from our store.");
    await loadSuggestedProducts(null);
    return;
  }

  // Active Product Found
  currentProduct = product;
  renderProductUI(product);
  updateSEO(product);
  
  // Check if already in cart after user state or product load
  if (currentUser) {
    await checkIfAlreadyInCart();
  }

  await loadSuggestedProducts(product.categoryId, product.id);
});

// --- URL Slug Parser ---
function extractSlugFromURL() {
  const search = window.location.search;
  if (!search || search.length <= 1) return null;

  const queryWithoutQuestion = search.substring(1);
  const firstParam = queryWithoutQuestion.split('&')[0];
  let rawKey = firstParam.split('=')[0];

  rawKey = decodeURIComponent(rawKey).trim();

  const trackingParams = ['fbclid', 'gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref'];
  if (trackingParams.includes(rawKey.toLowerCase())) return null;

  let normalized = rawKey.replace(/-true$/i, '');
  return normalized || null;
}

// --- Firestore Product Search ---
async function fetchProductBySlug(normalizedSlug) {
  try {
    const q = query(collection(db, "products"), where("productSlug", "==", normalizedSlug), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching product:", error);
    return null;
  }
}

// --- Render Main Product Page UI ---
function renderProductUI(product) {
  skeletonLoader.classList.add('hidden');
  productContent.classList.remove('hidden');

  document.getElementById('productTitle').textContent = product.productName || 'Untitled Product';

  if (product.categoryId) {
    fetchCategoryName(product.categoryId);
  } else if (product.categoryName) {
    document.getElementById('categoryWrapper').classList.remove('hidden');
    document.getElementById('categoryValue').textContent = product.categoryName;
  }

  if (product.SKU) {
    document.getElementById('skuWrapper').classList.remove('hidden');
    document.getElementById('skuValue').textContent = product.SKU;
  }

  if (product.warranty) {
    document.getElementById('warrantyBadge').classList.remove('hidden');
    document.getElementById('warrantyText').textContent = `Warranty: ${product.warranty}`;
  }
  if (product.freeDelivery) {
    document.getElementById('deliveryBadge').classList.remove('hidden');
  }

  if (product.productDescription) {
    descriptionCard.classList.remove('hidden');
    document.getElementById('productDescription').textContent = product.productDescription;
  }

  initCountdown(product.offerTime);
  setupGallery(product.productImage || [], product.videoLink);
  renderVariants(product.variants || []);
  updateCalculatedPrice();
}

// --- Pricing & Variants Logic ---
function updateCalculatedPrice() {
  let basePrice = Number(currentProduct.productPrice) || 0;
  let extraSum = 0;

  Object.values(selectedVariants).forEach(val => {
    extraSum += Number(val.extraPrice) || 0;
  });

  const finalUnitPrice = basePrice + extraSum;
  document.getElementById('currentPrice').textContent = `৳${finalUnitPrice.toLocaleString()}`;

  const oldPrice = Number(currentProduct.oldPrice) || 0;
  const oldPriceElem = document.getElementById('oldPrice');
  const discountBadge = document.getElementById('discountBadge');
  const savingsAmount = document.getElementById('savingsAmount');

  if (oldPrice > finalUnitPrice) {
    const saved = oldPrice - finalUnitPrice;
    const percent = Math.round((saved / oldPrice) * 100);

    oldPriceElem.textContent = `৳${oldPrice.toLocaleString()}`;
    oldPriceElem.classList.remove('hidden');

    discountBadge.textContent = `${percent}% OFF`;
    discountBadge.classList.remove('hidden');

    savingsAmount.textContent = `You save: ৳${saved.toLocaleString()}`;
    savingsAmount.classList.remove('hidden');
  } else {
    oldPriceElem.classList.add('hidden');
    discountBadge.classList.add('hidden');
    savingsAmount.classList.add('hidden');
  }
}

function renderVariants(variants) {
  const wrapper = document.getElementById('variantsWrapper');
  wrapper.innerHTML = '';
  selectedVariants = {};

  if (!variants || variants.length === 0) return;

  variants.forEach((group) => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'variant-group';

    const label = document.createElement('span');
    label.className = 'variant-label';
    label.textContent = `${group.name}:`;
    groupDiv.appendChild(label);

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'variant-options';

    group.values.forEach(valObj => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'variant-chip';
      const extraTxt = valObj.extraPrice > 0 ? ` +৳${valObj.extraPrice}` : '';
      btn.innerHTML = `<span>${escapeHTML(valObj.value)}${extraTxt}</span><span class="chk-icon hidden">${SVG_CHECK}</span>`;

      btn.addEventListener('click', () => {
        optionsDiv.querySelectorAll('.variant-chip').forEach(c => {
          c.classList.remove('selected');
          c.querySelector('.chk-icon').classList.add('hidden');
        });
        btn.classList.add('selected');
        btn.querySelector('.chk-icon').classList.remove('hidden');

        selectedVariants[group.name] = valObj;
        document.getElementById('variantError').classList.add('hidden');
        updateCalculatedPrice();
      });

      optionsDiv.appendChild(btn);
    });

    groupDiv.appendChild(optionsDiv);
    wrapper.appendChild(groupDiv);
  });
}

// --- Image & Video Gallery ---
function setupGallery(images, videoLink) {
  const track = document.getElementById('sliderTrack');
  const thumbList = document.getElementById('thumbnailList');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const tabVideo = document.getElementById('tabVideo');
  const tabImages = document.getElementById('tabImages');
  const videoContainer = document.getElementById('videoContainer');

  track.innerHTML = '';
  thumbList.innerHTML = '';

  const fallbackImg = 'https://ghotimarket.com/amrweb/banner1.png';
  const imgList = images.length > 0 ? images : [fallbackImg];

  imgList.forEach((src, idx) => {
    const slide = document.createElement('div');
    slide.className = 'slide-item';
    const img = document.createElement('img');
    img.src = src;
    img.alt = currentProduct?.productName || 'Product Image';
    img.loading = idx === 0 ? 'eager' : 'lazy';
    img.onerror = () => { img.src = fallbackImg; };
    slide.appendChild(img);
    track.appendChild(slide);

    const thumb = document.createElement('div');
    thumb.className = `thumb-item ${idx === 0 ? 'active' : ''}`;
    thumb.innerHTML = `<img src="${src}" alt="Thumb" onerror="this.src='${fallbackImg}'">`;
    thumb.addEventListener('click', () => {
      currentImageIndex = idx;
      updateSliderPosition();
      switchToMedia('image');
    });
    thumbList.appendChild(thumb);
  });

  prevBtn.addEventListener('click', () => {
    currentImageIndex = (currentImageIndex - 1 + imgList.length) % imgList.length;
    updateSliderPosition();
    resetAutoSwipe();
  });

  nextBtn.addEventListener('click', () => {
    currentImageIndex = (currentImageIndex + 1) % imgList.length;
    updateSliderPosition();
    resetAutoSwipe();
  });

  if (videoLink && videoLink.includes('embed')) {
    tabVideo.classList.remove('hidden');
    videoContainer.innerHTML = `<iframe src="${videoLink}" title="Product Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;

    tabVideo.addEventListener('click', () => switchToMedia('video'));
    tabImages.addEventListener('click', () => switchToMedia('image'));
  }

  startAutoSwipe(imgList.length);
}

function updateSliderPosition() {
  const track = document.getElementById('sliderTrack');
  track.style.transform = `translateX(-${currentImageIndex * 100}%)`;

  const thumbs = document.querySelectorAll('.thumb-item');
  thumbs.forEach((t, i) => {
    t.classList.toggle('active', i === currentImageIndex);
  });
}

function switchToMedia(type) {
  const sliderViewport = document.getElementById('sliderViewport');
  const videoContainer = document.getElementById('videoContainer');
  const tabImages = document.getElementById('tabImages');
  const tabVideo = document.getElementById('tabVideo');

  if (type === 'video') {
    sliderViewport.classList.add('hidden');
    videoContainer.classList.remove('hidden');
    tabVideo.classList.add('active');
    tabImages.classList.remove('active');
    clearInterval(slideInterval);
  } else {
    videoContainer.classList.add('hidden');
    sliderViewport.classList.remove('hidden');
    tabImages.classList.add('active');
    tabVideo.classList.remove('active');
  }
}

function startAutoSwipe(length) {
  if (length <= 1) return;
  clearInterval(slideInterval);
  slideInterval = setInterval(() => {
    currentImageIndex = (currentImageIndex + 1) % length;
    updateSliderPosition();
  }, 4000);
}

function resetAutoSwipe() {
  const images = currentProduct?.productImage || [];
  startAutoSwipe(images.length);
}

// --- Offer Countdown ---
function initCountdown(offerTime) {
  if (!offerTime || offerTime <= Date.now()) return;

  const countdownElem = document.getElementById('offerCountdown');
  countdownElem.classList.remove('hidden');

  function updateTimer() {
    const now = Date.now();
    const diff = offerTime - now;

    if (diff <= 0) {
      countdownElem.classList.add('hidden');
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / 1000 / 60) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    document.getElementById('cdDays').textContent = String(days).padStart(2, '0');
    document.getElementById('cdHours').textContent = String(hours).padStart(2, '0');
    document.getElementById('cdMins').textContent = String(mins).padStart(2, '0');
    document.getElementById('cdSecs').textContent = String(secs).padStart(2, '0');
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}

// --- Category Dynamic Fetch ---
async function fetchCategoryName(categoryId) {
  try {
    const catDoc = await getDoc(doc(db, "categories", categoryId));
    if (catDoc.exists()) {
      document.getElementById('categoryWrapper').classList.remove('hidden');
      document.getElementById('categoryValue').textContent = catDoc.data().categoryName || 'General';
    }
  } catch (err) {
    console.warn("Could not load category:", err);
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  document.getElementById('qtyMinus').addEventListener('click', () => {
    if (currentQuantity > 1) {
      currentQuantity--;
      document.getElementById('qtyValue').textContent = currentQuantity;
    }
  });

  document.getElementById('qtyPlus').addEventListener('click', () => {
    currentQuantity++;
    document.getElementById('qtyValue').textContent = currentQuantity;
  });

  addToCartBtn.addEventListener('click', () => handleCartOrBuyAction('cart'));
  document.getElementById('buyNowBtn').addEventListener('click', () => handleCartOrBuyAction('buy'));

  document.getElementById('closeAuthModal').addEventListener('click', () => authModal.classList.add('hidden'));
  document.getElementById('googleSignInBtn').addEventListener('click', handleGoogleLogin);
}

// --- Check Cart Status & Update UI ---
async function checkIfAlreadyInCart() {
  if (!currentUser || !currentProduct) return;

  try {
    const userCartRef = doc(db, "carts", currentUser.uid);
    const docSnap = await getDoc(userCartRef);

    if (docSnap.exists()) {
      const items = docSnap.data().items || [];
      const exists = items.some(item => item.productId === currentProduct.id);
      
      if (exists) {
        setCartAlreadyAddedUI();
      } else {
        setCartDefaultUI();
      }
    }
  } catch (err) {
    console.error("Error checking cart status:", err);
  }
}

function setCartAlreadyAddedUI() {
  addToCartBtn.classList.add('already-added');
  addToCartBtn.disabled = true;
  addToCartBtn.innerHTML = `
    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
    <span>This product already cart added</span>
  `;
}

function setCartDefaultUI() {
  addToCartBtn.classList.remove('already-added');
  addToCartBtn.disabled = false;
  addToCartBtn.innerHTML = `
    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
    <span>Add to Cart</span>
  `;
}

// --- Add To Cart & Buy Now Flow ---
async function handleCartOrBuyAction(actionType) {
  if (!currentProduct || !currentProduct.active) return;

  const requiredGroupCount = currentProduct.variants ? currentProduct.variants.length : 0;
  if (Object.keys(selectedVariants).length < requiredGroupCount) {
    document.getElementById('variantError').classList.remove('hidden');
    return;
  }

  pendingAction = actionType;

  if (!currentUser) {
    authModal.classList.remove('hidden');
    return;
  }

  await processCartSaveAndNavigate();
}

async function processCartSaveAndNavigate() {
  const isDuplicate = await checkAndSaveToCart();

  if (pendingAction === 'buy') {
    window.location.href = '/checkout';
  } else if (pendingAction === 'cart') {
    if (isDuplicate) {
      showToast("Already cart added");
      setCartAlreadyAddedUI();
    } else {
      showToast("Added to Cart successfully!");
      setCartAlreadyAddedUI();
      updateCartBadge();
    }
  }
  pendingAction = null;
}

// --- Firestore Cart Saving & Check ---
async function checkAndSaveToCart() {
  if (!currentUser) return false;

  const userCartRef = doc(db, "carts", currentUser.uid);

  try {
    const docSnap = await getDoc(userCartRef);
    let items = [];

    if (docSnap.exists()) {
      items = docSnap.data().items || [];
    }

    const existingIndex = items.findIndex(item => item.productId === currentProduct.id);
    if (existingIndex > -1) {
      return true;
    }

    let basePrice = Number(currentProduct.productPrice) || 0;
    let extraSum = 0;
    Object.values(selectedVariants).forEach(v => extraSum += (Number(v.extraPrice) || 0));
    const finalUnitPrice = basePrice + extraSum;

    const newItem = {
      productId: currentProduct.id,
      productName: currentProduct.productName,
      productSlug: currentProduct.productSlug,
      productImage: currentProduct.productImage ? currentProduct.productImage[0] : '',
      productPrice: basePrice,
      selectedVariants: selectedVariants,
      quantity: currentQuantity,
      unitPrice: finalUnitPrice,
      totalPrice: finalUnitPrice * currentQuantity,
      SKU: currentProduct.SKU || '',
      categoryId: currentProduct.categoryId || '',
      freeDelivery: !!currentProduct.freeDelivery,
      addedAt: new Date().toISOString()
    };

    items.push(newItem);

    await setDoc(userCartRef, {
      uid: currentUser.uid,
      email: currentUser.email,
      updatedAt: new Date().toISOString(),
      items: items
    }, { merge: true });

    return false;
  } catch (err) {
    console.error("Cart save error:", err);
    showToast("Failed to update cart. Please try again.");
    return false;
  }
}

// --- Google Sign-In ---
async function handleGoogleLogin() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    currentUser = result.user;
    authModal.classList.add('hidden');
    updateCartBadge();
    await checkIfAlreadyInCart();

    if (pendingAction) {
      await processCartSaveAndNavigate();
    }
  } catch (error) {
    console.error("Auth error:", error);
    showToast("Sign in failed or was cancelled.");
  }
}

// --- Firebase Auth Observer ---
function setupAuthObserver() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      updateCartBadge();
      await checkIfAlreadyInCart();
    } else {
      cartBadge.textContent = '0';
      setCartDefaultUI();
    }
  });
}

// --- Update Header Cart Quantity ---
async function updateCartBadge() {
  if (!currentUser) {
    cartBadge.textContent = '0';
    return;
  }
  try {
    const docSnap = await getDoc(doc(db, "carts", currentUser.uid));
    if (docSnap.exists() && docSnap.data().items) {
      cartBadge.textContent = docSnap.data().items.length;
    } else {
      cartBadge.textContent = '0';
    }
  } catch (err) {
    console.warn("Could not update badge:", err);
  }
}

// --- Suggested Products Loader ---
async function loadSuggestedProducts(categoryId, currentId = null) {
  const grid = document.getElementById('suggestedGrid');
  grid.innerHTML = '';

  try {
    let q = query(collection(db, "products"), where("active", "==", true), limit(8));
    if (categoryId) {
      q = query(collection(db, "products"), where("active", "==", true), where("categoryId", "==", categoryId), limit(8));
    }

    let querySnapshot = await getDocs(q);

    if (querySnapshot.empty && categoryId) {
      q = query(collection(db, "products"), where("active", "==", true), limit(8));
      querySnapshot = await getDocs(q);
    }

    querySnapshot.docs.forEach(docSnap => {
      if (docSnap.id === currentId) return;

      const data = docSnap.data();
      const card = document.createElement('a');
      card.className = 'product-card';
      card.href = `/gadgetitem/product?${data.productSlug}`;

      const img = data.productImage && data.productImage[0] ? data.productImage[0] : 'https://ghotimarket.com/amrweb/banner1.png';

      card.innerHTML = `
        <div class="card-img-wrap">
          <img src="${img}" alt="${escapeHTML(data.productName)}" loading="lazy">
        </div>
        <h3 class="card-name">${escapeHTML(data.productName)}</h3>
        <div class="card-price-row">
          <span class="card-price">৳${data.productPrice}</span>
          ${data.oldPrice > data.productPrice ? `<span class="card-old-price">৳${data.oldPrice}</span>` : ''}
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error("Suggested products error:", err);
  }
}

// --- Dynamic SEO Updates ---
function updateSEO(product) {
  const title = `${product.productName} | Gadgeta Item`;
  document.title = title;

  const desc = product.productDescription ? product.productDescription.substring(0, 160) : "Buy high quality gadgets online at Gadgeta Item.";
  const img = product.productImage && product.productImage[0] ? product.productImage[0] : 'https://ghotimarket.com/amrweb/banner1.png';
  const url = window.location.href;

  updateMetaTag('description', desc);
  updateMetaTag('og:title', title, 'property');
  updateMetaTag('og:description', desc, 'property');
  updateMetaTag('og:image', img, 'property');
  updateMetaTag('og:url', url, 'property');
  updateMetaTag('twitter:title', title);
  updateMetaTag('twitter:description', desc);
  updateMetaTag('twitter:image', img);

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.productName,
    "image": product.productImage || [img],
    "description": desc,
    "sku": product.SKU || "",
    "offers": {
      "@type": "Offer",
      "priceCurrency": "BDT",
      "price": product.productPrice,
      "availability": "https://schema.org/InStock"
    }
  };
  document.getElementById('product-schema').textContent = JSON.stringify(schema);
}

function updateMetaTag(name, content, attribute = 'name') {
  let element = document.querySelector(`meta[${attribute}="${name}"]`);
  if (element) {
    element.setAttribute('content', content);
  }
}

function showStatusState(title, message) {
  skeletonLoader.classList.add('hidden');
  productContent.classList.add('hidden');
  statusCard.classList.remove('hidden');
  statusIcon.innerHTML = SVG_ERROR;
  statusTitle.textContent = title;
  statusMessage.textContent = message;
}

function showToast(msg) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHTML(str) {
  return String(str || '').replace(/[&<>"']/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[match]));
}
