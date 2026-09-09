import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// DOM Elements
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.getElementById("btnText");
const btnLoader = document.getElementById("btnLoader");
const btnIcon = document.getElementById("btnIcon");
const alertBox = document.getElementById("alertBox");
const alertIcon = document.getElementById("alertIcon");
const alertMessage = document.getElementById("alertMessage");
const togglePasswordBtn = document.getElementById("togglePassword");
const eyeShowIcon = document.getElementById("eyeShowIcon");
const eyeHideIcon = document.getElementById("eyeHideIcon");

// SVG Error Icon Template
const svgErrorIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

// Show Error UI Function
function showError(message) {
    alertIcon.innerHTML = svgErrorIcon;
    alertMessage.textContent = message;
    alertBox.classList.remove("hidden");
}

// Hide Error UI Function
function hideError() {
    alertBox.classList.add("hidden");
    alertMessage.textContent = "";
}

// Set Loading State
function setLoading(isLoading) {
    if (isLoading) {
        submitBtn.disabled = true;
        emailInput.disabled = true;
        passwordInput.disabled = true;
        btnText.classList.add("hidden");
        btnIcon.classList.add("hidden");
        btnLoader.classList.remove("hidden");
    } else {
        submitBtn.disabled = false;
        emailInput.disabled = false;
        passwordInput.disabled = false;
        btnText.classList.remove("hidden");
        btnIcon.classList.remove("hidden");
        btnLoader.classList.add("hidden");
    }
}

// Password Visibility Toggle
togglePasswordBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    if (isPassword) {
        eyeShowIcon.classList.add("hidden");
        eyeHideIcon.classList.remove("hidden");
    } else {
        eyeShowIcon.classList.remove("hidden");
        eyeHideIcon.classList.add("hidden");
    }
});

// 10. Already Logged-In Users Handler on Page Load
onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
        const authenticatedEmail = user.email;

        // Check Owner condition first
        if (authenticatedEmail === OWNER_EMAIL) {
            window.location.href = "dashboard.html";
            return;
        }

        // Check Admin condition
        const adminRef = doc(db, "admins", authenticatedEmail);
        const adminSnap = await getDoc(adminRef);

        if (adminSnap.exists() && adminSnap.data().active === true) {
            window.location.href = "dashboard.html";
        } else if (!adminSnap.exists()) {
            showError("You are not authorized to access the admin panel.");
        } else {
            showError("Your admin account is currently inactive. Please contact the owner.");
        }
    } catch (error) {
        showError("Unable to verify admin access. Please try again.");
    }
});

// Form Submission & Authentication Flow Logic
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError("Please enter both email and password.");
        return;
    }

    setLoading(true);

    try {
        // Step 1 — Firebase Authentication (Required for both Owner and Admin)
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Security requirement: use validated authenticated email directly
        const authenticatedUser = userCredential.user;
        const verifiedEmail = authenticatedUser.email;

        // Step 2 — Owner vs Admin Priority Logic Flow Check
        if (verifiedEmail === OWNER_EMAIL) {
            window.location.href = "dashboard.html";
            return;
        }

        // Step 3 — Check Admin Firestore Document
        let adminSnap;
        try {
            const adminRef = doc(db, "admins", verifiedEmail);
            adminSnap = await getDoc(adminRef);
        } catch (firestoreError) {
            setLoading(false);
            showError("Unable to verify admin access. Please try again.");
            return;
        }

        // Step 4 — Admin Permission Rules Validation Check
        if (!adminSnap.exists()) {
            setLoading(false);
            showError("You are not authorized to access the admin panel.");
            return;
        }

        const adminData = adminSnap.data();
        if (adminData.active !== true) {
            setLoading(false);
            showError("Your admin account is currently inactive. Please contact the owner.");
            return;
        }

        // Success Flow - Redirect immediately
        window.location.href = "dashboard.html";

    } catch (authError) {
        setLoading(false);
        // Do not expose internal technical error details to users
        showError("Invalid email or password.");
    }
});
