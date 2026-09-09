import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, startAfter, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

// State Variables
let lastVisible = null;
let isLoading = false;
let hasMore = true;
let allCategoriesList = [];

// DOM Elements
const categoryGrid = document.getElementById('giCategoryGrid');
const loadMoreContainer = document.getElementById('giLoadMoreContainer');
const loadMoreBtn = document.getElementById('giLoadMoreBtn');
const errorState = document.getElementById('giErrorState');
const emptyState = document.getElementById('giEmptyState');
const retryBtn = document.getElementById('giRetryBtn');
const headerCartBadge = document.getElementById('giHeaderCartBadge');
const mobCartBadge = document.getElementById('giMobCartBadge');

// Safe HTML Escaping Helper
function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, match => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[match]));
}

// Render Skeletons
function renderSkeletons(count = 10) {
    let skeletonsHTML = '';
    for (let i = 0; i < count; i++) {
        skeletonsHTML += `
            <div class="gi-skeleton-card">
                <div class="gi-skeleton-img"></div>
                <div class="gi-skeleton-text-area">
                    <div class="gi-skeleton-line"></div>
                </div>
            </div>
        `;
    }
    categoryGrid.innerHTML = skeletonsHTML;
}

// Authentication & Cart State Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await fetchUserCart(user.uid);
    } else {
        updateCartBadges(0);
    }
});

async function fetchUserCart(uid) {
    try {
        const cartRef = doc(db, "carts", uid);
        const docSnap = await getDoc(cartRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const items = Array.isArray(data.items) ? data.items : [];
            updateCartBadges(items.length);
        } else {
            updateCartBadges(0);
        }
    } catch (error) {
        console.error("Error fetching cart data:", error);
        updateCartBadges(0);
    }
}

function updateCartBadges(count) {
    if (headerCartBadge) headerCartBadge.textContent = count;
    if (mobCartBadge) mobCartBadge.textContent = count;
}

// Fetch Categories with Pagination and Fallback Sorting
async function loadCategories(isLoadMore = false) {
    if (isLoading) return;
    if(isLoadMore && !hasMore) return;
    isLoading = true;

    if (!isLoadMore) {
        errorState.style.display = 'none';
        emptyState.style.display = 'none';
        allCategoriesList = [];
        lastVisible = null;
        hasMore = true;
        renderSkeletons(10);
    } else {
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading...';
    }

    try {
        let q;
        // INDEX ছাড়া SIMPLE QUERY - এটাই সবসময় কাজ করবে
        if (!isLoadMore || !lastVisible) {
            q = query(collection(db, "categories"), limit(20));
        } else {
            q = query(collection(db, "categories"), startAfter(lastVisible), limit(20));
        }

        const querySnapshot = await getDocs(q);
        console.log("Found categories:", querySnapshot.size); // Debug

        if (!isLoadMore) categoryGrid.innerHTML = '';

        if (querySnapshot.empty) {
            hasMore = false;
            loadMoreContainer.style.display = 'none';
            if (!isLoadMore) {
                emptyState.style.display = 'block';
                categoryGrid.style.display = 'none';
            }
            return;
        }

        lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        if (querySnapshot.docs.length < 20) hasMore = false;

        const newCategories = [];
        querySnapshot.forEach(docSnap => {
            newCategories.push({ id: docSnap.id, ...docSnap.data() });
        });

        allCategoriesList = [...allCategoriesList, ...newCategories];
        renderCategories(newCategories);

        categoryGrid.style.display = 'grid';
        loadMoreContainer.style.display = hasMore ? 'flex' : 'none';
        updateStructuredData(allCategoriesList);

    } catch (error) {
        console.error("Error loading categories:", error);
        if (!isLoadMore) {
            categoryGrid.style.display = 'none';
            errorState.style.display = 'block';
        }
    } finally {
        isLoading = false;
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load More Categories';
    }
}

// Render Categories Grid
function renderCategories(categories) {
    let html = '';
    categories.forEach(category => {
        const name = escapeHTML(category.categoryName || 'Unnamed Category');
        const slug = escapeHTML(category.categorySlug || generateSlug(category.categoryName));
        const imgSrc = escapeHTML(category.categoryImage || 'https://ghotimarket.com/amrweb/banner1.png');

        html += `
            <div class="gi-category-card" onclick="window.location.href='category?${slug}'">
                <div class="gi-card-img-wrapper">
                    <img src="${imgSrc}" alt="${name}" class="gi-card-img" loading="lazy" onerror="this.src='https://ghotimarket.com/amrweb/banner1.png'">
                </div>
                <div class="gi-card-body">
                    <h3 class="gi-category-name">${name}</h3>
                    <div class="gi-card-arrow" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"/>
                        </svg>
                    </div>
                </div>
            </div>
        `;
    });
    categoryGrid.insertAdjacentHTML('beforeend', html);
}

// Helper Slug Generator
function generateSlug(name) {
    if (!name) return 'category';
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

// Update Structured Data dynamically
function updateStructuredData(categories) {
    const scriptEl = document.getElementById('giStructuredData');
    if (!scriptEl) return;

    const itemListElements = categories.map((cat, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": cat.categoryName || 'Category',
        "url": `https://gadgeta-item.com/category?${cat.categorySlug || ''}`
    }));

    const structuredData = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": itemListElements
    };

    scriptEl.textContent = JSON.stringify(structuredData, null, 2);
}

// Event Listeners
if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => loadCategories(true));
}

if (retryBtn) {
    retryBtn.addEventListener('click', () => loadCategories(false));
}

// Initial Load Execution
loadCategories(false);
