import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// FIREBASE CONFIGURATION
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


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// DOM ELEMENTS
// ==========================================
const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");
const loginForm = document.getElementById("loginForm");
const loginEmailInput = document.getElementById("loginEmail");
const loginPasswordInput = document.getElementById("loginPassword");
const togglePasswordBtn = document.getElementById("togglePassword");
const loginError = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmailDisplay = document.getElementById("userEmailDisplay");

const videoGrid = document.getElementById("videoGrid");
const emptyState = document.getElementById("emptyState");
const videoCountStat = document.getElementById("videoCountStat");
const videoRemainingStat = document.getElementById("videoRemainingStat");
const systemStatusText = document.getElementById("systemStatusText");
const limitStatusCard = document.getElementById("limitStatusCard");

// Direct Form Elements
const formSectionTitle = document.getElementById("formSectionTitle");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const videoForm = document.getElementById("videoForm");
const editingVideoId = document.getElementById("editingVideoId");
const videoTitleInput = document.getElementById("videoTitleInput");
const videoLinkInput = document.getElementById("videoLinkInput");
const videoPreviewContainer = document.getElementById("videoPreviewContainer");
const videoPreviewIframe = document.getElementById("videoPreviewIframe");
const thumbnailInput = document.getElementById("thumbnailInput");
const thumbReqMark = document.getElementById("thumbReqMark");
const thumbnailPreviewWrapper = document.getElementById("thumbnailPreviewWrapper");
const thumbnailPreviewImg = document.getElementById("thumbnailPreviewImg");
const ownerEmailInput = document.getElementById("ownerEmailInput");
const modalError = document.getElementById("modalError");
const saveVideoBtn = document.getElementById("saveVideoBtn");

const deleteModal = document.getElementById("deleteModal");
const closeDeleteModalBtn = document.getElementById("closeDeleteModalBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

const limitModal = document.getElementById("limitModal");
const closeLimitModalBtn = document.getElementById("closeLimitModalBtn");
const okLimitBtn = document.getElementById("okLimitBtn");

const toastContainer = document.getElementById("toastContainer");

let currentUserVideos = [];
let videoToDeleteId = null;
let currentSelectedImageFile = null;

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icon = type === "success" ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ==========================================
// AUTHENTICATION OBSERVER
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginScreen.classList.add("hidden");
        dashboardScreen.classList.remove("hidden");
        userEmailDisplay.textContent = user.email;
        ownerEmailInput.value = user.email;
        await fetchUserVideos();
    } else {
        dashboardScreen.classList.add("hidden");
        loginScreen.classList.remove("hidden");
        videoGrid.innerHTML = "";
        currentUserVideos = [];
    }
});

// Password Show/Hide
togglePasswordBtn.addEventListener("click", () => {
    const type = loginPasswordInput.getAttribute("type") === "password" ? "text" : "password";
    loginPasswordInput.setAttribute("type", type);
    togglePasswordBtn.innerHTML = type === "password" ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
});

// Login Handler
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;

    if (!email || !password) {
        showLoginError("দয়া করে ইমেল এবং পাসওয়ার্ড প্রদান করুন।");
        return;
    }

    setButtonLoading(loginBtn, true, "Signing in...");
    loginError.classList.add("hidden");

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("সফলভাবে লগইন হয়েছে", "success");
        loginForm.reset();
    } catch (error) {
        console.error("Login error:", error);
        showLoginError("লগইন ব্যর্থ হয়েছে। সঠিক ইমেল এবং পাসওয়ার্ড দিন।");
    } finally {
        setButtonLoading(loginBtn, false, "Login");
    }
});

function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove("hidden");
}

// Logout Handler
logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
        showToast("সফলভাবে লগআউট হয়েছে", "success");
    } catch (error) {
        console.error("Logout error:", error);
    }
});

// ==========================================
// YOUTUBE URL PROCESSING & VALIDATION
// ==========================================
function extractYouTubeVideoID(url) {
    if (!url) return null;
    let cleanedUrl = url.trim();
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = cleanedUrl.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function processYouTubeUrl(url) {
    const videoId = extractYouTubeVideoID(url);
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
}

videoLinkInput.addEventListener("input", () => {
    const rawUrl = videoLinkInput.value.trim();
    const embedUrl = processYouTubeUrl(rawUrl);
    if (embedUrl) {
        videoPreviewIframe.src = embedUrl;
        videoPreviewContainer.classList.remove("hidden");
    } else {
        videoPreviewIframe.src = "";
        videoPreviewContainer.classList.add("hidden");
    }
});

// ==========================================
// AUTO CROP TO 9:16 ASPECT RATIO LOGIC
// ==========================================
function cropImageTo9_16(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                // Target Aspect Ratio 9:16
                const targetRatio = 9 / 16;
                let srcWidth = img.width;
                let srcHeight = img.height;
                let srcX = 0;
                let srcY = 0;

                const currentRatio = srcWidth / srcHeight;

                if (currentRatio > targetRatio) {
                    // Image is wider than 9:16, crop width (sides)
                    srcWidth = srcHeight * targetRatio;
                    srcX = (img.width - srcWidth) / 2;
                } else if (currentRatio < targetRatio) {
                    // Image is taller than 9:16, crop height (top/bottom)
                    srcHeight = srcWidth / targetRatio;
                    srcY = (img.height - srcHeight) / 2;
                }

                // Set fixed high quality output resolution for 9:16 (e.g. 720 x 1280)
                const outputWidth = 720;
                const outputHeight = 1280;

                canvas.width = outputWidth;
                canvas.height = outputHeight;

                ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, outputWidth, outputHeight);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error("Canvas to Blob conversion failed"));
                        return;
                    }
                    const croppedFile = new File([blob], file.name || "thumbnail_9_16.jpg", {
                        type: "image/jpeg",
                        lastModified: Date.now()
                    });
                    resolve({ croppedFile, dataUrl: canvas.toDataURL("image/jpeg") });
                }, "image/jpeg", 0.90);
            };
            img.onerror = (err) => reject(err);
            img.src = event.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

// ==========================================
// THUMBNAIL PREVIEW & SELECTION
// ==========================================
thumbnailInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            showToast("থাম্বনেইল ৯:১৬ সাইজে ক্রপ করা হচ্ছে...", "success");
            const { croppedFile, dataUrl } = await cropImageTo9_16(file);
            currentSelectedImageFile = croppedFile;
            
            thumbnailPreviewImg.src = dataUrl;
            thumbnailPreviewWrapper.classList.remove("hidden");
            showToast("থাম্বনেইল সফলভাবে ৯:১৬ ফরম্যাটে প্রস্তুত করা হয়েছে", "success");
        } catch (error) {
            console.error("Crop error:", error);
            showToast("থাম্বনেইল প্রসেস করতে সমস্যা হয়েছে", "error");
        }
    }
});

// ==========================================
// FETCH & RENDER USER VIDEOS
// ==========================================
async function fetchUserVideos() {
    try {
        const q = query(
            collection(db, "youtube_video"),
            where("email", "==", auth.currentUser.email)
        );
        const querySnapshot = await getDocs(q);
        currentUserVideos = [];
        querySnapshot.forEach((docSnap) => {
            currentUserVideos.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderDashboard();
    } catch (error) {
        console.error("Error fetching videos:", error);
        showToast("ভিডিও লোড করতে সমস্যা হয়েছে", "error");
    }
}

function renderDashboard() {
    const count = currentUserVideos.length;
    videoCountStat.textContent = `${count} / 10`;
    videoRemainingStat.textContent = `${10 - count}`;

    if (count >= 10) {
        systemStatusText.textContent = "Limit Reached";
        limitStatusCard.style.borderColor = "var(--danger)";
        videoForm.querySelectorAll("input, button[type='submit']").forEach(el => {
            if(editingVideoId.value === "") el.disabled = true;
        });
    } else {
        systemStatusText.textContent = "Active";
        limitStatusCard.style.borderColor = "var(--border)";
        videoForm.querySelectorAll("input, button[type='submit']").forEach(el => el.disabled = false);
    }

    videoGrid.innerHTML = "";
    if (count === 0) {
        emptyState.classList.remove("hidden");
        videoGrid.classList.add("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    videoGrid.classList.remove("hidden");

    currentUserVideos.forEach((video) => {
        const card = document.createElement("div");
        card.className = "video-card";
        
        const formattedDate = video.createdAt?.toDate 
            ? video.createdAt.toDate().toLocaleDateString("bn-BD", { year: 'numeric', month: 'short', day: 'numeric' }) 
            : "Recently Added";

        card.innerHTML = `
            <div class="card-player-wrapper">
                <iframe src="${video.videoLink}" loading="lazy" allowfullscreen title="${video.title}"></iframe>
            </div>
            <div class="card-body">
                <h3 class="card-title" title="${video.title}">${video.title}</h3>
                <div class="card-meta">
                    <span><i class="fa-regular fa-calendar"></i> ${formattedDate}</span>
                </div>
                <div class="card-actions">
                    <button class="btn btn-outline btn-sm edit-btn" data-id="${video.id}"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                    <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${video.id}"><i class="fa-solid fa-trash"></i> Delete</button>
                </div>
            </div>
        `;
        videoGrid.appendChild(card);
    });

    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => setupEditForm(btn.getAttribute("data-id")));
    });
    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => promptDeleteVideo(btn.getAttribute("data-id")));
    });
}

// ==========================================
// IMGBB CONFIGURATION & UPLOAD SYSTEM
// ==========================================
async function retrieveImgBBAPIKey() {
    const q = query(
        collection(db, "imgbb_api"),
        where("uid", "==", auth.currentUser.uid)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    const docData = querySnapshot.docs[0].data();
    return docData.apiKey;
}

async function uploadThumbnailToImgBB(imageFile) {
    const apiKey = await retrieveImgBBAPIKey();
    if (!apiKey) {
        throw new Error("ImgBB API configuration not found.");
    }

    const formData = new FormData();
    formData.append("key", apiKey);
    formData.append("image", imageFile);

    const response = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: formData
    });

    const result = await response.json();
    if (result && result.success) {
        return result.data.url;
    } else {
        throw new Error(result.error?.message || "ImgBB upload failed.");
    }
}

// ==========================================
// FORM EDIT / CREATE CONTROLS
// ==========================================
function setupEditForm(id) {
    const video = currentUserVideos.find(v => v.id === id);
    if (!video) return;

    editingVideoId.value = video.id;
    formSectionTitle.textContent = "Edit Video Review";
    cancelEditBtn.classList.remove("hidden");
    saveVideoBtn.querySelector(".btn-text").textContent = "Update Video";

    videoTitleInput.value = video.title;
    videoLinkInput.value = video.videoLink;
    ownerEmailInput.value = video.email;
    
    videoPreviewIframe.src = video.videoLink;
    videoPreviewContainer.classList.remove("hidden");

    thumbnailPreviewImg.src = video.thumbnail;
    thumbnailPreviewWrapper.classList.remove("hidden");
    
    thumbReqMark.classList.add("hidden"); 
    currentSelectedImageFile = null;
    modalError.classList.add("hidden");

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

cancelEditBtn.addEventListener("click", resetVideoForm);

function resetVideoForm() {
    videoForm.reset();
    editingVideoId.value = "";
    formSectionTitle.textContent = "Add New Video";
    cancelEditBtn.classList.add("hidden");
    saveVideoBtn.querySelector(".btn-text").textContent = "Save Video";
    ownerEmailInput.value = auth.currentUser.email;
    videoPreviewContainer.classList.add("hidden");
    thumbnailPreviewWrapper.classList.add("hidden");
    modalError.classList.add("hidden");
    currentSelectedImageFile = null;
    thumbReqMark.classList.remove("hidden");
}

// Save / Create / Update Video Form Submission
videoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    modalError.classList.add("hidden");

    const title = videoTitleInput.value.trim();
    const rawLink = videoLinkInput.value.trim();
    const isEdit = editingVideoId.value !== "";

    if (!title) {
        showFormError("দয়া করে ভিডিওর শিরোনাম দিন।");
        return;
    }

    const embedUrl = processYouTubeUrl(rawLink);
    if (!embedUrl) {
        showFormError("দয়া করে একটি সঠিক ইউটিউব লিংক (Shorts বা Standard) প্রদান করুন।");
        return;
    }

    try {
        if (!isEdit) {
            if (currentUserVideos.length >= 10) {
                limitModal.classList.remove("hidden");
                return;
            }
            if (!currentSelectedImageFile) {
                showFormError("দয়া করে একটি থাম্বনেইল ছবি নির্বাচন করুন।");
                return;
            }
        }

        let finalThumbnailUrl = null;

        if (currentSelectedImageFile) {
            setButtonLoading(saveVideoBtn, true, "Uploading thumbnail...");
            
            const apiKeyCheck = await retrieveImgBBAPIKey();
            if (!apiKeyCheck) {
                setButtonLoading(saveVideoBtn, false, isEdit ? "Update Video" : "Save Video");
                showFormError("আপনার অ্যাকাউন্টে ImgBB API Key সেট করা নেই। প্রথমে ImgBB API Key সেটআপ করুন।");
                return;
            }

            finalThumbnailUrl = await uploadThumbnailToImgBB(currentSelectedImageFile);
        } else if (isEdit) {
            const existing = currentUserVideos.find(v => v.id === editingVideoId.value);
            finalThumbnailUrl = existing.thumbnail;
        }

        setButtonLoading(saveVideoBtn, true, isEdit ? "Updating video..." : "Saving video...");

        if (isEdit) {
            const docRef = doc(db, "youtube_video", editingVideoId.value);
            await updateDoc(docRef, {
                title: title,
                videoLink: embedUrl,
                thumbnail: finalThumbnailUrl
            });
            showToast("ভিডিও সফলভাবে আপডেট করা হয়েছে", "success");
        } else {
            await addDoc(collection(db, "youtube_video"), {
                title: title,
                videoLink: embedUrl,
                thumbnail: finalThumbnailUrl,
                email: auth.currentUser.email,
                createdAt: serverTimestamp()
            });
            showToast("ভিডিও সফলভাবে যোগ করা হয়েছে", "success");
        }

        resetVideoForm();
        await fetchUserVideos();
    } catch (error) {
        console.error("Save error:", error);
        showFormError(error.message || "সংরক্ষণ করতে সমস্যা হয়েছে।");
    } finally {
        setButtonLoading(saveVideoBtn, false, isEdit ? "Update Video" : "Save Video");
    }
});

function showFormError(msg) {
    modalError.textContent = msg;
    modalError.classList.remove("hidden");
}

// ==========================================
// DELETE WORKFLOW
// ==========================================
function promptDeleteVideo(id) {
    videoToDeleteId = id;
    deleteModal.classList.remove("hidden");
}

closeDeleteModalBtn.addEventListener("click", closeDeleteModal);
cancelDeleteBtn.addEventListener("click", closeDeleteModal);

function closeDeleteModal() {
    deleteModal.classList.add("hidden");
    videoToDeleteId = null;
}

confirmDeleteBtn.addEventListener("click", async () => {
    if (!videoToDeleteId) return;

    setButtonLoading(confirmDeleteBtn, true, "Deleting...");
    try {
        await deleteDoc(doc(db, "youtube_video", videoToDeleteId));
        showToast("ভিডিও সফলভাবে ডিলিট করা হয়েছে", "success");
        closeDeleteModal();
        await fetchUserVideos();
    } catch (error) {
        console.error("Delete error:", error);
        showToast("ডিলিট করতে সমস্যা হয়েছে", "error");
    } finally {
        setButtonLoading(confirmDeleteBtn, false, "Confirm Delete");
    }
});

closeLimitModalBtn.addEventListener("click", () => limitModal.classList.add("hidden"));
okLimitBtn.addEventListener("click", () => limitModal.classList.add("hidden"));

function setButtonLoading(button, isLoading, text) {
    const btnText = button.querySelector(".btn-text");
    const spinner = button.querySelector(".spinner");
    if (isLoading) {
        button.disabled = true;
        if (btnText) btnText.textContent = text;
        if (spinner) spinner.classList.remove("hidden");
    } else {
        button.disabled = false;
        if (btnText) btnText.textContent = text;
        if (spinner) spinner.classList.add("hidden");
    }
}
