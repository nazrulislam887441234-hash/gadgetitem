import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    getDocs, 
    query, 
    where, 
    addDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// FIREBASE CONFIGURATION STRUCTURE
// ==========================================
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
const auth = getAuth(app);
const db = getFirestore(app);

// Global State Management
let currentUser = null;
let selectedImages = []; // Array of { file, id, status, url }
let isManualSlugEdited = false;
let categoriesList = [];

// DOM Elements
const authLoader = document.getElementById('auth-loader');
const appContainer = document.getElementById('app-container');
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const productForm = document.getElementById('product-upload-form');
const imageInput = document.getElementById('product-image-input');
const dropZone = document.getElementById('dropzone');
const imagePreviewContainer = document.getElementById('image-preview-grid');
const productNameInput = document.getElementById('product-name');
const productSlugInput = document.getElementById('product-slug');
const categorySelect = document.getElementById('category-select');
const categoryLoading = document.getElementById('category-loading');
const addVariantBtn = document.getElementById('add-variant-btn');
const variantsContainer = document.getElementById('variants-container');
const submitBtn = document.getElementById('submit-btn');

// ==========================================
// 1. AUTHENTICATION PROTECTION
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        if (userEmailDisplay) userEmailDisplay.textContent = user.email;
        if (authLoader) authLoader.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
        initApp();
    } else {
        window.location.href = 'login.html';
    }
});

// Logout Event Handler
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'login.html';
        } catch (error) {
            console.error("Logout error:", error);
            showToast("লগআউট করতে সমস্যা হয়েছে।", "error");
        }
    });
}

// Initialize App Data
function initApp() {
    loadCategories();
    setupEventListeners();
}

// ==========================================
// 2. EVENT LISTENERS SETUP
// ==========================================
function setupEventListeners() {
    if (productNameInput) {
        productNameInput.addEventListener('input', (e) => {
            if (!isManualSlugEdited && productSlugInput) {
                productSlugInput.value = generateSlug(e.target.value);
            }
        });
    }

    if (productSlugInput) {
        productSlugInput.addEventListener('input', () => {
            isManualSlugEdited = true;
        });
    }

    // Image Drag & Drop / File Selection
    if (dropZone && imageInput) {
        dropZone.addEventListener('click', () => imageInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
        dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border-color)'; });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-color)';
            if (e.dataTransfer.files) {
                handleFilesSelection(e.dataTransfer.files);
            }
        });

        imageInput.addEventListener('change', (e) => {
            if (e.target.files) {
                handleFilesSelection(e.target.files);
            }
        });
    }

    // Variant Builder
    if (addVariantBtn) {
        addVariantBtn.addEventListener('click', () => addVariantBlock());
    }

    // Form Submission
    if (productForm) {
        productForm.addEventListener('submit', handleFormSubmit);
    }
}

// ==========================================
// 3. UTILITY FUNCTIONS & SLUG GENERATOR
// ==========================================
function generateSlug(text) {
    if (!text) return '';
    return text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0980-\u09FF\-\_]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================
// 4. LOAD CATEGORIES FROM FIRESTORE
// ==========================================
async function loadCategories() {
    try {
        if (categoryLoading) categoryLoading.classList.remove('hidden');
        const querySnapshot = await getDocs(collection(db, "categories"));
        categoriesList = [];
        querySnapshot.forEach((doc) => {
            categoriesList.push({ id: doc.id, ...doc.data() });
        });

        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">ক্যাটাগরি নির্বাচন করুন</option>';
            categoriesList.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.categoryName || 'Unnamed Category';
                categorySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error loading categories:", error);
        showToast("ক্যাটাগরি লোড করতে ব্যর্থ হয়েছে", "error");
    } finally {
        if (categoryLoading) categoryLoading.classList.add('hidden');
    }
}

// ==========================================
// 5. PRODUCT IMAGE MANAGEMENT & VALIDATION
// ==========================================
function handleFilesSelection(files) {
    const maxFileSize = 5 * 1024 * 1024; // 5MB limit
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) {
            showToast(`File "${file.name}" সঠিক ইমেজ ফাইল নয়।`, 'error');
            return;
        }
        if (file.size > maxFileSize) {
            showToast(`File "${file.name}" ৫ মেগাবাইটের বেশি বড়।`, 'error');
            return;
        }

        const fileId = '_' + Math.random().toString(36).substring(2, 9);
        selectedImages.push({
            id: fileId,
            file: file,
            status: 'pending',
            url: null
        });
    });
    renderImagePreviews();
}

function renderImagePreviews() {
    if (!imagePreviewContainer) return;
    imagePreviewContainer.innerHTML = '';
    selectedImages.forEach((imgObj) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const item = document.createElement('div');
            item.className = 'image-preview-item';
            item.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button type="button" class="remove-img-btn" data-id="${imgObj.id}">&times;</button>
                ${imgObj.status === 'uploading' ? `<div class="image-preview-overlay">আপলোড হচ্ছে...</div>` : ''}
                ${imgObj.status === 'failed' ? `<div class="image-preview-overlay" style="background:rgba(239,68,68,0.8)">ব্যর্থ</div>` : ''}
            `;
            
            item.querySelector('.remove-img-btn').addEventListener('click', () => {
                selectedImages = selectedImages.filter(item => item.id !== imgObj.id);
                renderImagePreviews();
            });

            imagePreviewContainer.appendChild(item);
        };
        reader.readAsDataURL(imgObj.file);
    });
}

// ==========================================
// 6. IMGBB API FETCH & IMAGE UPLOAD
// ==========================================
async function fetchImgBBApiKey(uid, email) {
    try {
        const q = query(collection(db, "imgbb_api"), where("uid", "==", uid));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            const qEmail = query(collection(db, "imgbb_api"), where("email", "==", email));
            const emailSnapshot = await getDocs(qEmail);
            if (emailSnapshot.empty) return null;
            return emailSnapshot.docs[0].data().apiKey;
        }
        return querySnapshot.docs[0].data().apiKey;
    } catch (error) {
        console.error("Error fetching ImgBB API key:", error);
        return null;
    }
}

async function uploadImageToImgBB(file, apiKey) {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData
    });

    const data = await response.json();
    if (data && data.success) {
        return data.data.url;
    } else {
        throw new Error(data.error?.message || "Image upload failed");
    }
}

// ==========================================
// 7. VARIANT BUILDER MANAGEMENT
// ==========================================
function addVariantBlock() {
    if (!variantsContainer) return;
    const variantId = '_' + Math.random().toString(36).substring(2, 9);
    const block = document.createElement('div');
    block.className = 'variant-block';
    block.dataset.variantId = variantId;
    
    block.innerHTML = `
        <div class="variant-block-header">
            <input type="text" class="variant-name-input" placeholder="ভ্যারিয়েন্টের নাম (যেমন: সাইজ / Color)" required>
            <button type="button" class="btn-danger-text remove-variant-block">রিমুভ করুন</button>
        </div>
        <div class="variant-values-list"></div>
        <button type="button" class="btn-secondary add-variant-value-btn">+ ভ্যালু যোগ করুন</button>
    `;

    block.querySelector('.remove-variant-block').addEventListener('click', () => block.remove());
    block.querySelector('.add-variant-value-btn').addEventListener('click', () => {
        addVariantValueRow(block.querySelector('.variant-values-list'));
    });

    variantsContainer.appendChild(block);
    addVariantValueRow(block.querySelector('.variant-values-list'));
}

function addVariantValueRow(valuesListContainer) {
    const row = document.createElement('div');
    row.className = 'variant-value-row';
    row.innerHTML = `
        <input type="text" class="v-val" placeholder="ভ্যালু (যেমন: M বা Black)" required>
        <input type="number" class="v-price" placeholder="অতিরিক্ত মূল্য" value="0" min="0">
        <button type="button" class="btn-danger-text remove-val-row">ডিলিট</button>
    `;
    row.querySelector('.remove-val-row').addEventListener('click', () => row.remove());
    valuesListContainer.appendChild(row);
}

function collectVariantsData() {
    if (!variantsContainer) return [];
    const variantBlocks = variantsContainer.querySelectorAll('.variant-block');
    const variantsArray = [];

    variantBlocks.forEach(block => {
        const variantNameInput = block.querySelector('.variant-name-input');
        if (!variantNameInput) return;
        const variantName = variantNameInput.value.trim();
        if (!variantName) return;

        const valuesRows = block.querySelectorAll('.variant-value-row');
        const valuesArray = [];
        const seenValues = new Set();

        valuesRows.forEach(row => {
            const valInput = row.querySelector('.v-val');
            const priceInput = row.querySelector('.v-price');
            if (!valInput) return;

            const val = valInput.value.trim();
            const extraPrice = priceInput ? (parseFloat(priceInput.value) || 0) : 0;

            if (val) {
                if (seenValues.has(val)) {
                    showToast(`ডুপ্লিকেট ভ্যালু "${val}" পাওয়া গেছে "${variantName}" ফিল্ডে।`, 'error');
                } else {
                    seenValues.add(val);
                    valuesArray.push({ value: val, extraPrice: extraPrice });
                }
            }
        });

        if (valuesArray.length > 0) {
            variantsArray.push({ name: variantName, values: valuesArray });
        }
    });

    return variantsArray;
}

// ==========================================
// 8. ADVANCED UNIQUE SLUG GENERATOR
// ==========================================
/**
 * Generates an 8-character cryptographically stronger random alphanumeric suffix.
 */
function generateRandomSuffix() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(8);
    window.crypto.getRandomValues(array);
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars[array[i] % chars.length];
    }
    return result;
}

/**
 * Checks Firestore to ensure productSlug uniqueness, adding a random suffix if a collision occurs.
 * Max retry limit: 15 attempts.
 */
async function generateUniqueSlug(baseSlug) {
    let currentSlug = baseSlug;
    let attempts = 0;
    const maxAttempts = 15;
    let isModified = false;

    while (attempts < maxAttempts) {
        // Note: Firestore client-side query cannot provide absolute 100% database-level concurrency locking 
        // without transactions, but this checks existing records to minimize collisions significantly.
        const q = query(collection(db, "products"), where("productSlug", "==", currentSlug));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            break; // Unique slug found!
        }

        // Collision detected, append an 8-character random suffix
        const randomSuffix = generateRandomSuffix();
        currentSlug = `${baseSlug}-${randomSuffix}`;
        isModified = true;
        attempts++;
    }

    if (attempts >= maxAttempts) {
        throw new Error("ইউনিক প্রোডাক্ট স্লাগ তৈরি করা সম্ভব হয়নি। অনুগ্রহ করে অন্য নাম ব্যবহার করুন।");
    }

    if (isModified) {
        showToast("এই স্লাগটি আগে থেকেই ছিল। নতুন ইউনিক স্লাগ তৈরি করা হয়েছে।", "info");
    }

    return currentSlug;
}

// ==========================================
// 9. UNIVERSAL YOUTUBE URL PARSER
// ==========================================
/**
 * Robustly parses various YouTube URL formats (watch, shorts, embed, live, youtu.be, nocookie)
 * and validates the 11-character Video ID via regex.
 */
function parseYouTubeEmbedLink(url) {
    if (!url) return null;
    
    // Trim accidental whitespace before/after
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return null;

    let videoId = null;

    try {
        // Use URL constructor for reliable parsing of hostname, path, and query params
        const parsedUrl = new URL(trimmedUrl);
        let hostname = parsedUrl.hostname.toLowerCase();

        // Normalize supported hostnames (remove leading 'www.', 'm.', etc. for checking)
        if (hostname.startsWith('www.')) {
            hostname = hostname.replace('www.', '');
        }

        // Valid YouTube hostnames whitelist check
        const validHostnames = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'youtube-nocookie.com'];
        const isValidHost = validHostnames.some(h => hostname === h || hostname.endsWith('.' + h));

        if (!isValidHost) {
            return null;
        }

        const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

        if (hostname === 'youtu.be') {
            // Format: https://youtu.be/VIDEO_ID
            if (pathSegments.length > 0) {
                videoId = pathSegments[0];
            }
        } else {
            // Formats: /watch, /shorts/VIDEO_ID, /embed/VIDEO_ID, /live/VIDEO_ID
            if (pathSegments.length > 0) {
                const firstSegment = pathSegments[0];
                if (firstSegment === 'watch') {
                    videoId = parsedUrl.searchParams.get('v');
                } else if (['shorts', 'embed', 'live'].includes(firstSegment) && pathSegments.length > 1) {
                    videoId = pathSegments[1];
                }
            }
        }
    } catch (e) {
        // Fallback or invalid URL structure handled below via Regex check
    }

    // Fallback/Reinforced regex matching if URL constructor fails or handles edge paths
    if (!videoId) {
        const fallbackRegExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|shorts\/|live\/)([^#\&\?]*).*/;
        const match = trimmedUrl.match(fallbackRegExp);
        if (match && match[2]) {
            videoId = match[2].split('?')[0].split('&')[0];
        }
    }

    // YouTube Video ID Validation: exactly 11 characters containing A-Z, a-z, 0-9, _, -
    const videoIdRegex = /^[A-Za-z0-9_-]{11}$/;
    if (videoId && videoIdRegex.test(videoId)) {
        return `https://www.youtube.com/embed/${videoId}`;
    }

    return null;
}

// ==========================================
// 10. COMPLETE SUBMIT FLOW
// ==========================================
async function handleFormSubmit(e) {
    e.preventDefault();

    const productNameEl = document.getElementById('product-name');
    const productPriceEl = document.getElementById('product-price');
    const categorySelectEl = document.getElementById('category-select');
    const videoLinkEl = document.getElementById('video-link');

    const productName = productNameEl ? productNameEl.value.trim() : '';
    const productPrice = productPriceEl ? parseFloat(productPriceEl.value) : NaN;
    const categoryId = categorySelectEl ? categorySelectEl.value : '';
    const videoLinkRaw = videoLinkEl ? videoLinkEl.value.trim() : '';

    // Phase 1: Early Form Validations (Before Image Upload to prevent long waits on invalid data)
    if (!productName) {
        showToast("প্রোডাক্টের নাম আবশ্যক।", "error");
        if (productNameEl) productNameEl.focus();
        return;
    }
    if (isNaN(productPrice) || productPrice < 0) {
        showToast("সঠিক প্রোডাক্ট মূল্য প্রদান করুন।", "error");
        if (productPriceEl) productPriceEl.focus();
        return;
    }
    if (selectedImages.length === 0) {
        showToast("অন্তত একটি প্রোডাক্ট ইমেজ আপলোড করুন।", "error");
        return;
    }
    if (!categoryId) {
        showToast("অনুগ্রহ করে একটি ক্যাটাগরি নির্বাচন করুন।", "error");
        if (categorySelectEl) categorySelectEl.focus();
        return;
    }

    // Validate YouTube URL early if provided
    let validatedVideoLink = null;
    if (videoLinkRaw) {
        validatedVideoLink = parseYouTubeEmbedLink(videoLinkRaw);
        if (!validatedVideoLink) {
            showToast("সঠিক ইউটিউব ভিডিও লিংক প্রদান করুন।", "error");
            if (videoLinkEl) videoLinkEl.focus();
            return;
        }
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "প্রসেসিং হচ্ছে...";
    }

    try {
        showToast("ImgBB API কি ফেচ করা হচ্ছে...", "info");
        const imgbbApiKey = await fetchImgBBApiKey(currentUser.uid, currentUser.email);
        
        if (!imgbbApiKey) {
            throw new Error("ImgBB API কনফিগারেশন পাওয়া যায়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।");
        }

        showToast("ইমেজ আপলোড হচ্ছে...", "info");
        const uploadedImageUrls = [];
        
        for (const imgObj of selectedImages) {
            imgObj.status = 'uploading';
            renderImagePreviews();
            try {
                const url = await uploadImageToImgBB(imgObj.file, imgbbApiKey);
                imgObj.url = url;
                imgObj.status = 'success';
                uploadedImageUrls.push(url);
            } catch (err) {
                imgObj.status = 'failed';
                renderImagePreviews();
                throw new Error(`ইমেজ আপলোড ব্যর্থ হয়েছে: ${imgObj.file.name}`);
            }
        }
        renderImagePreviews();

        const selectedCategoryObj = categoriesList.find(cat => cat.id === categoryId);
        const categoryName = selectedCategoryObj ? selectedCategoryObj.categoryName : "";

        const oldPriceEl = document.getElementById('old-price');
        const oldPriceVal = oldPriceEl ? oldPriceEl.value : '';
        const oldPrice = oldPriceVal ? parseFloat(oldPriceVal) : null;

        const warrantyTypeEl = document.getElementById('warranty-type');
        const warrantyNumEl = document.getElementById('warranty-number');
        const warrantyType = warrantyTypeEl ? warrantyTypeEl.value : 'Days';
        const warrantyNum = warrantyNumEl ? warrantyNumEl.value : '';
        const warranty = warrantyNum ? `${warrantyNum} ${warrantyType}` : null;

        const offerTimeEl = document.getElementById('offer-time');
        const offerTimeInputVal = offerTimeEl ? offerTimeEl.value : '';
        const offerTime = offerTimeInputVal ? new Date(offerTimeInputVal).getTime() : null;

        const productDescEl = document.getElementById('product-description');
        const skuInputEl = document.getElementById('sku-input');
        const activeStatusEl = document.getElementById('active-status');
        const freeDeliveryInput = document.querySelector('input[name="free-delivery"]:checked');

        // Resolve and Guarantee Product Slug Uniqueness before saving
        const rawSlugInput = productSlugInput ? productSlugInput.value.trim() : '';
        const baseSlug = rawSlugInput || generateSlug(productName);
        const uniqueProductSlug = await generateUniqueSlug(baseSlug);

        const productData = {
            productImage: uploadedImageUrls,
            productName: productName,
            productPrice: productPrice,
            oldPrice: oldPrice,
            productDescription: productDescEl ? productDescEl.value.trim() : '',
            productSlug: uniqueProductSlug,
            warranty: warranty,
            categoryId: categoryId,
            categoryName: categoryName,
            freeDelivery: freeDeliveryInput ? freeDeliveryInput.value === 'true' : false,
            variants: collectVariantsData(),
            SKU: skuInputEl ? skuInputEl.value.trim() || null : null,
            active: activeStatusEl ? activeStatusEl.checked : true,
            offerTime: offerTime,
            videoLink: validatedVideoLink,
            email: currentUser.email,
            uid: currentUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        showToast("ডেটাবেসে সেভ করা হচ্ছে...", "info");
        await addDoc(collection(db, "products"), productData);

        showToast("প্রোডাক্ট সফলভাবে প্রকাশিত হয়েছে!", "success");
        if (productForm) productForm.reset();
        selectedImages = [];
        renderImagePreviews();
        isManualSlugEdited = false;
        if (variantsContainer) variantsContainer.innerHTML = '';

    } catch (error) {
        console.error("Submission Error:", error);
        showToast(error.message || "একটি অপ্রত্যাশিত ত্রুটি ঘটেছে।", "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "প্রোডাক্ট প্রকাশ করুন";
        }
    }
}
