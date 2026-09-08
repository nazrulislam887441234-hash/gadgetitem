// ==========================================
// 1. FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Reusable Firebase Configuration Object
const firebaseConfig = {
  apiKey: "AIzaSyBEZA5iQBxOUJaKvFMtpVi6w-jMATNESoA",
  authDomain: "gadget-item.firebaseapp.com",
  projectId: "gadget-item",
  storageBucket: "gadget-item.firebasestorage.app",
  messagingSenderId: "1048854789116",
  appId: "1:1048854789116:web:50911b221edc2181be5079",
  measurementId: "G-9FGC1BKNYL"
};

// Initialize Firebase securely
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================================
// 2. CONFIGURATIONS (Banners, Categories, URLs)
// ==========================================
const bannerLinks = [
  "https://store.ghotimarket.com",
  "https://store.ghotimarket.com/all-product",
  "https://store.ghotimarket.com/special-offer"
];

const categoryData = [
  { name: "Watch", image: "https://i.ibb.co.com/0pDsGP55/20260907-205504.png", link: "category?watch" },
  { name: "Light", image: "https://i.ibb.co.com/nsQySCwZ/143349-flashlight-beam-vector-photos-free-clipart-hq.png", link: "category?light" },
  { name: "Power Bank", image: "https://i.ibb.co.com/3KqQYhh/usams-35w-pd-10000mah-power-bank.png", link: "category?power-bank" },
  { name: "Phone", image: "https://i.ibb.co.com/XxYx9Hq0/Smartphone-Download-PNG.png", link: "category?phone" },
  { name: "Head Phone", image: "https://i.ibb.co.com/1V21Q20/pngtree-wireless-headphone-png-image-20721964.png", link: "category?head-phone" },
  { name: "Others Exercise & Gadgets", image: "https://i.ibb.co.com/mVZpWsPB/pngtree-modern-desktop-personal-computer-and-other-gadgets-png-image-15589716.png", link: "category?others" }
];

// Product URL generator helper
function getProductUrl(slug) {
  const cleanSlug = slug && typeof slug === 'string' ? slug.trim() : 'item';
  return `product?${cleanSlug}`;
}

// ==========================================
// 3. HERO BANNER CAROUSEL LOGIC (AUTO & TOUCH SLIDE)
// ==========================================
function initHeroCarousel() {
  const track = document.getElementById('giCarouselTrack');
  if (!track) return;

  const originalSlides = Array.from(track.children);
  const slideCount = originalSlides.length;
  const dotsContainer = document.getElementById('giCarouselDots');
  const dots = Array.from(dotsContainer ? dotsContainer.children : []);

  // Bind configurable banner links safely
  const link1 = document.getElementById('giBannerLink1');
  const link2 = document.getElementById('giBannerLink2');
  const link3 = document.getElementById('giBannerLink3');
  if (link1) link1.href = bannerLinks[0];
  if (link2) link2.href = bannerLinks[1];
  if (link3) link3.href = bannerLinks[2];

  // Clone first slide for seamless infinite transition
  const firstClone = originalSlides[0].cloneNode(true);
  track.appendChild(firstClone);

  let currentIndex = 0;
  let isTransitioning = false;

  function updateCarousel(index, smooth = true) {
    track.style.transition = smooth ? 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
    track.style.transform = `translateX(-${index * 100}%)`;

    const activeDotIndex = index >= slideCount ? 0 : index;
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === activeDotIndex);
    });
  }

  function nextSlide() {
    if (isTransitioning) return;
    isTransitioning = true;
    currentIndex++;
    updateCarousel(currentIndex, true);

    if (currentIndex >= slideCount) {
      setTimeout(() => {
        currentIndex = 0;
        updateCarousel(currentIndex, false);
        isTransitioning = false;
      }, 500);
    } else {
      setTimeout(() => {
        isTransitioning = false;
      }, 500);
    }
  }

  function prevSlide() {
    if (isTransitioning) return;
    isTransitioning = true;
    
    if (currentIndex <= 0) {
      currentIndex = slideCount;
      updateCarousel(currentIndex, false);
      setTimeout(() => {
        currentIndex = slideCount - 1;
        updateCarousel(currentIndex, true);
        setTimeout(() => { isTransitioning = false; }, 500);
      }, 20);
    } else {
      currentIndex--;
      updateCarousel(currentIndex, true);
      setTimeout(() => { isTransitioning = false; }, 500);
    }
  }

  // Dots click navigation
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      if (isTransitioning) return;
      currentIndex = index;
      updateCarousel(currentIndex, true);
    });
  });

  // Auto slide interval
  let slideInterval = setInterval(nextSlide, 4500);
  const carouselEl = document.getElementById('giHeroCarousel');
  if (carouselEl) {
    carouselEl.addEventListener('mouseenter', () => clearInterval(slideInterval));
    carouselEl.addEventListener('mouseleave', () => { slideInterval = setInterval(nextSlide, 4500); });

    // Mobile Swipe support
    let touchStartX = 0;
    let touchEndX = 0;

    carouselEl.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
    carouselEl.addEventListener('touchend', e => {
      touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 40) nextSlide();
      if (touchEndX - touchStartX > 40) prevSlide();
    }, {passive: true});
  }
}

// ==========================================
// 4. RENDER SHOP CATEGORIES
// ==========================================
function renderCategories() {
  const container = document.getElementById('giCategoriesContainer');
  if (!container) return;

  container.innerHTML = '';
  categoryData.forEach(cat => {
    const card = document.createElement('a');
    card.href = cat.link;
    card.className = 'gi-category-card';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'gi-category-img-wrap';

    const img = document.createElement('img');
    img.src = cat.image.startsWith('http') ? cat.image : 'https://store.ghotimarket.com/website-logo.png';
    img.alt = cat.name;
    img.loading = 'lazy';
    img.onerror = function() { this.src = 'https://store.ghotimarket.com/website-logo.png'; };

    imgWrap.appendChild(img);

    const nameEl = document.createElement('span');
    nameEl.className = 'gi-category-name';
    nameEl.textContent = cat.name;

    card.appendChild(imgWrap);
    card.appendChild(nameEl);

    container.appendChild(card);
  });
}

// ==========================================
// 5. PRODUCT CARD BUILDER & PRICE MATH
// ==========================================
function buildProductCard(product) {
  const card = document.createElement('a');
  const slug = product.productSlug || 'item';
  card.href = getProductUrl(slug);
  card.className = 'gi-product-card';

  // Thumb container
  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'gi-product-thumb';

  const img = document.createElement('img');
  img.src = product.productImage || 'https://store.ghotimarket.com/website-logo.png';
  img.alt = product.productName || 'Gadget Item';
  img.loading = 'lazy';
  img.onerror = function() { this.src = 'https://store.ghotimarket.com/website-logo.png'; };
  thumbWrap.appendChild(img);

  // Discount Calculation & Badge
  const currentPrice = Number(product.productPrice) || 0;
  const oldPrice = Number(product.oldPrice) || 0;

  if (oldPrice > currentPrice && oldPrice > 0) {
    const discountAmount = oldPrice - currentPrice;
    const discountPct = Math.round((discountAmount / oldPrice) * 100);

    const badge = document.createElement('span');
    badge.className = 'gi-discount-badge';
    badge.textContent = `${discountPct}% OFF`;
    thumbWrap.appendChild(badge);
  }

  card.appendChild(thumbWrap);

  // Details
  const details = document.createElement('div');
  details.className = 'gi-product-details';

  const title = document.createElement('h3');
  title.className = 'gi-product-title';
  title.textContent = product.productName || 'Untitled Product';
  details.appendChild(title);

  const priceWrap = document.createElement('div');
  priceWrap.className = 'gi-price-wrap';

  const currPriceEl = document.createElement('span');
  currPriceEl.className = 'gi-current-price';
  currPriceEl.textContent = `৳ ${currentPrice.toLocaleString('en-BD')}`;
  priceWrap.appendChild(currPriceEl);

  if (oldPrice > currentPrice && oldPrice > 0) {
    const priceRow = document.createElement('div');
    priceRow.className = 'gi-price-row';

    const oldPriceEl = document.createElement('span');
    oldPriceEl.className = 'gi-old-price';
    oldPriceEl.textContent = `৳ ${oldPrice.toLocaleString('en-BD')}`;
    priceRow.appendChild(oldPriceEl);
    priceWrap.appendChild(priceRow);

    const discountAmount = oldPrice - currentPrice;
    const discountPct = Math.round((discountAmount / oldPrice) * 100);

    const saveText = document.createElement('span');
    saveText.className = 'gi-save-text';
    saveText.textContent = `Save ৳${discountAmount.toLocaleString('en-BD')} · ${discountPct}% OFF`;
    priceWrap.appendChild(saveText);
  }

  details.appendChild(priceWrap);
  card.appendChild(details);

  return card;
}

// ==========================================
// 6. FETCH PRODUCTS FROM FIRESTORE
// ==========================================
async function loadProducts(collectionName, containerId, retryCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const q = query(collection(db, collectionName), orderBy("createdAt", "desc"), limit(20));
    const snapshot = await getDocs(q);

    container.innerHTML = '';

    if (snapshot.empty) {
      container.innerHTML = `
        <div class="gi-state-box">
          <p>No products available yet.</p>
        </div>
      `;
      return;
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const card = buildProductCard(data);
      container.appendChild(card);
    });

  } catch (error) {
    console.error(`Error loading ${collectionName}:`, error);
    container.innerHTML = `
      <div class="gi-state-box">
        <p>Unable to load products right now. Please try again.</p>
      </div>
    `;
  }
}

// ==========================================
// 7. YOUTUBE VIDEO EXTRACTION & MODAL
// ==========================================
function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function initVideoModal() {
  const modal = document.getElementById('giVideoModal');
  const overlay = document.getElementById('giModalOverlay');
  const closeBtn = document.getElementById('giModalClose');
  const modalBody = document.getElementById('giModalBody');
  if (!modal) return;

  function closeModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    modalBody.innerHTML = '';
  }

  if (overlay) overlay.addEventListener('click', closeModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  window.openVideoModal = function(videoUrl) {
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) {
      window.open(videoUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    modalBody.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  };
}

async function loadYouTubeVideos() {
  const container = document.getElementById('giVideoGrid');
  if (!container) return;

  try {
    const q = query(collection(db, "youtube_video"), orderBy("createdAt", "desc"), limit(8));
    const snapshot = await getDocs(q);

    container.innerHTML = '';

    if (snapshot.empty) {
      container.innerHTML = `
        <div class="gi-state-box">
          <p>No videos available yet.</p>
        </div>
      `;
      return;
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const title = data.title || 'Gadgets Item Video';
      const videoLink = data.videoLink || '#';
      const thumbnail = data.thumbnail || 'https://store.ghotimarket.com/website-logo.png';

      const card = document.createElement('div');
      card.className = 'gi-video-card';
      card.addEventListener('click', () => window.openVideoModal(videoLink));

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'gi-video-thumb-wrap';

      const img = document.createElement('img');
      img.src = thumbnail;
      img.alt = title;
      img.loading = 'lazy';
      img.onerror = function() { this.src = 'https://store.ghotimarket.com/website-logo.png'; };
      thumbWrap.appendChild(img);

      const playOverlay = document.createElement('div');
      playOverlay.className = 'gi-play-overlay';
      playOverlay.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      thumbWrap.appendChild(playOverlay);

      card.appendChild(thumbWrap);

      const titleEl = document.createElement('h3');
      titleEl.className = 'gi-video-title';
      titleEl.textContent = title;
      card.appendChild(titleEl);

      container.appendChild(card);
    });

  } catch (error) {
    console.error("Error loading YouTube videos:", error);
    container.innerHTML = `
      <div class="gi-state-box">
        <p>Unable to load videos right now. Please try again.</p>
      </div>
    `;
  }
}

// ==========================================
// 8. INITIALIZE PAGE APP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initHeroCarousel();
  renderCategories();
  initVideoModal();

  // Load Firestore Data Collections
  loadProducts("products", "giRecentProductGrid");
  loadProducts("popular_products", "giPopularProductGrid");
  loadYouTubeVideos();
});
